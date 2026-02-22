// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IDecisionLog {
    function logDecision(address user, string calldata action, string calldata reasoning) external;
}

interface IAgentRegistry {
    function isAuthorized(address agent) external view returns (bool);
}

/**
 * @title Vault
 * @notice Main DeFi Copilot vault. Users deposit tokens; authorized agents rebalance.
 * @dev Security: Agents can ONLY rebalance — they CANNOT withdraw user funds.
 */
contract Vault is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ─── Types ───────────────────────────────────────────────────────────────

    enum RiskProfile { Conservative, Balanced, Aggressive }

    struct Allocation {
        address protocol;
        uint256 basisPoints;    // 100 = 1%,  10 000 = 100%
        string  protocolName;
    }

    struct UserState {
        uint256     balance;
        RiskProfile riskProfile;
        uint256     depositTimestamp;
        uint256     lastRebalanceTimestamp;
        uint256     totalYieldEarned;
        bool        isActive;
    }

    // ─── State ───────────────────────────────────────────────────────────────

    IERC20         public immutable depositToken;
    IDecisionLog   public decisionLog;
    IAgentRegistry public agentRegistry;

    mapping(address => UserState)    public userStates;
    mapping(address => Allocation[]) private userAllocations;

    uint256 public totalValueLocked;
    uint256 public rebalanceThresholdBps = 50; // 0.5 %

    // ─── Events ──────────────────────────────────────────────────────────────

    event Deposited(address indexed user, uint256 amount, uint256 timestamp);
    event Withdrawn(address indexed user, uint256 amount, uint256 timestamp);
    event Rebalanced(address indexed user, address indexed agent, uint256 timestamp);
    event RiskProfileUpdated(address indexed user, RiskProfile profile);
    event YieldCredited(address indexed user, uint256 amount);
    event ThresholdUpdated(uint256 newThresholdBps);

    // ─── Modifiers ───────────────────────────────────────────────────────────

    modifier onlyAuthorizedAgent() {
        require(agentRegistry.isAuthorized(msg.sender), "Vault: unauthorized agent");
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(
        address _depositToken,
        address _decisionLog,
        address _agentRegistry
    ) Ownable(msg.sender) {
        require(_depositToken   != address(0), "Vault: zero token address");
        require(_decisionLog    != address(0), "Vault: zero log address");
        require(_agentRegistry  != address(0), "Vault: zero registry address");
        depositToken   = IERC20(_depositToken);
        decisionLog    = IDecisionLog(_decisionLog);
        agentRegistry  = IAgentRegistry(_agentRegistry);
    }

    // ─── User functions ──────────────────────────────────────────────────────

    /**
     * @notice Deposit ERC-20 tokens into the vault.
     * @param amount Token amount (in token decimals).
     */
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Vault: amount must be positive");
        depositToken.safeTransferFrom(msg.sender, address(this), amount);

        UserState storage s = userStates[msg.sender];
        s.balance += amount;
        s.isActive  = true;
        if (s.depositTimestamp == 0) {
            s.depositTimestamp = block.timestamp;
        }
        totalValueLocked += amount;

        emit Deposited(msg.sender, amount, block.timestamp);
    }

    /**
     * @notice Withdraw tokens from the vault.
     * @dev ONLY the user may call this — agents are explicitly excluded.
     * @param amount Token amount to withdraw.
     */
    function withdraw(uint256 amount) external nonReentrant {
        UserState storage s = userStates[msg.sender];
        require(s.balance >= amount, "Vault: insufficient balance");

        s.balance -= amount;
        totalValueLocked -= amount;
        if (s.balance == 0) s.isActive = false;

        depositToken.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount, block.timestamp);
    }

    /**
     * @notice Set the caller's risk profile.
     * @param profile 0 = Conservative, 1 = Balanced, 2 = Aggressive
     */
    function setRiskProfile(RiskProfile profile) external {
        userStates[msg.sender].riskProfile = profile;
        emit RiskProfileUpdated(msg.sender, profile);
    }

    // ─── Agent functions ─────────────────────────────────────────────────────

    /**
     * @notice Rebalance a user's allocation across protocols.
     * @dev Only authorized agents. Agents CANNOT withdraw funds.
     * @param user          The user whose allocation to update.
     * @param protocols     Array of protocol addresses.
     * @param basisPoints   Array of allocations in basis points (must sum to 10 000).
     * @param protocolNames Human-readable protocol names for the decision log.
     * @param reasoning     LLM-generated reasoning string, stored in DecisionLog.
     */
    function rebalance(
        address          user,
        address[] calldata protocols,
        uint256[] calldata basisPoints,
        string[]  calldata protocolNames,
        string    calldata reasoning
    ) external onlyAuthorizedAgent nonReentrant {
        require(protocols.length == basisPoints.length,   "Vault: length mismatch");
        require(protocols.length == protocolNames.length, "Vault: length mismatch");
        require(protocols.length > 0,                     "Vault: empty allocation");
        require(userStates[user].isActive,                "Vault: user not active");

        uint256 totalBps;
        for (uint256 i; i < basisPoints.length; ++i) {
            totalBps += basisPoints[i];
        }
        require(totalBps == 10_000, "Vault: allocations must total 100%");

        delete userAllocations[user];
        for (uint256 i; i < protocols.length; ++i) {
            userAllocations[user].push(Allocation({
                protocol:     protocols[i],
                basisPoints:  basisPoints[i],
                protocolName: protocolNames[i]
            }));
        }

        userStates[user].lastRebalanceTimestamp = block.timestamp;
        decisionLog.logDecision(user, "REBALANCE", reasoning);

        emit Rebalanced(user, msg.sender, block.timestamp);
    }

    /**
     * @notice Credit yield to a user's balance (called by agent after harvesting).
     */
    function creditYield(address user, uint256 yieldAmount) external onlyAuthorizedAgent {
        userStates[user].balance         += yieldAmount;
        userStates[user].totalYieldEarned += yieldAmount;
        totalValueLocked                  += yieldAmount;
        emit YieldCredited(user, yieldAmount);
    }

    // ─── View functions ──────────────────────────────────────────────────────

    function getPortfolioState(address user)
        external
        view
        returns (
            uint256 balance,
            uint8   riskProfile,
            uint256 depositTimestamp,
            uint256 lastRebalanceTimestamp,
            uint256 totalYieldEarned,
            bool    isActive
        )
    {
        UserState storage s = userStates[user];
        return (
            s.balance,
            uint8(s.riskProfile),
            s.depositTimestamp,
            s.lastRebalanceTimestamp,
            s.totalYieldEarned,
            s.isActive
        );
    }

    function getAllocations(address user) external view returns (Allocation[] memory) {
        return userAllocations[user];
    }

    // ─── Owner functions ─────────────────────────────────────────────────────

    function setRebalanceThreshold(uint256 thresholdBps) external onlyOwner {
        require(thresholdBps <= 1_000, "Vault: threshold too high");
        rebalanceThresholdBps = thresholdBps;
        emit ThresholdUpdated(thresholdBps);
    }

    function updateDecisionLog(address _decisionLog) external onlyOwner {
        require(_decisionLog != address(0), "Vault: zero address");
        decisionLog = IDecisionLog(_decisionLog);
    }

    function updateAgentRegistry(address _agentRegistry) external onlyOwner {
        require(_agentRegistry != address(0), "Vault: zero address");
        agentRegistry = IAgentRegistry(_agentRegistry);
    }
}
