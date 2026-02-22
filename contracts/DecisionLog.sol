// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DecisionLog
 * @notice Immutable, append-only log of every agent decision for full on-chain transparency.
 * @dev Any contract registered as an authorized caller (e.g. Vault) can write entries.
 */
contract DecisionLog is Ownable {

    // ─── Types ───────────────────────────────────────────────────────────────

    struct Decision {
        address user;
        address agent;
        string  action;
        string  reasoning;
        uint256 timestamp;
        uint256 blockNumber;
    }

    // ─── State ───────────────────────────────────────────────────────────────

    mapping(address => Decision[]) private userDecisions;
    Decision[]                      public  allDecisions;
    mapping(address => bool)        public  authorizedCallers;

    // ─── Events ──────────────────────────────────────────────────────────────

    event DecisionLogged(
        address indexed user,
        address indexed agent,
        string  action,
        string  reasoning,
        uint256 timestamp,
        uint256 blockNumber
    );
    event CallerAuthorized(address indexed caller);
    event CallerRevoked(address indexed caller);

    // ─── Modifiers ───────────────────────────────────────────────────────────

    modifier onlyAuthorized() {
        require(
            authorizedCallers[msg.sender] || msg.sender == owner(),
            "DecisionLog: not authorized"
        );
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ─── Write ───────────────────────────────────────────────────────────────

    /**
     * @notice Append a decision entry for a user.
     * @param user      The user this decision relates to.
     * @param action    Short action label, e.g. "REBALANCE", "SWAP", "DEPOSIT".
     * @param reasoning LLM-generated explanation of why the action was taken.
     */
    function logDecision(
        address        user,
        string calldata action,
        string calldata reasoning
    ) external onlyAuthorized {
        Decision memory d = Decision({
            user:        user,
            agent:       msg.sender,
            action:      action,
            reasoning:   reasoning,
            timestamp:   block.timestamp,
            blockNumber: block.number
        });

        userDecisions[user].push(d);
        allDecisions.push(d);

        emit DecisionLogged(
            user,
            msg.sender,
            action,
            reasoning,
            block.timestamp,
            block.number
        );
    }

    // ─── Read ────────────────────────────────────────────────────────────────

    function getDecisionHistory(address user)
        external
        view
        returns (Decision[] memory)
    {
        return userDecisions[user];
    }

    function getDecisionCount(address user) external view returns (uint256) {
        return userDecisions[user].length;
    }

    function getLatestDecision(address user)
        external
        view
        returns (Decision memory)
    {
        Decision[] storage ds = userDecisions[user];
        require(ds.length > 0, "DecisionLog: no decisions for user");
        return ds[ds.length - 1];
    }

    function getDecisionsPaginated(
        address user,
        uint256 offset,
        uint256 limit
    ) external view returns (Decision[] memory page) {
        Decision[] storage ds = userDecisions[user];
        uint256 total = ds.length;
        if (offset >= total) return page;
        uint256 end = offset + limit > total ? total : offset + limit;
        page = new Decision[](end - offset);
        for (uint256 i = offset; i < end; ++i) {
            page[i - offset] = ds[i];
        }
    }

    function getAllDecisionsCount() external view returns (uint256) {
        return allDecisions.length;
    }

    // ─── Owner ───────────────────────────────────────────────────────────────

    function authorizeCaller(address caller) external onlyOwner {
        require(caller != address(0), "DecisionLog: zero address");
        authorizedCallers[caller] = true;
        emit CallerAuthorized(caller);
    }

    function revokeCaller(address caller) external onlyOwner {
        authorizedCallers[caller] = false;
        emit CallerRevoked(caller);
    }
}
