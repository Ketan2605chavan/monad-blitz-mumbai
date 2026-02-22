// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AgentRegistry
 * @notice Maintains a registry of authorized DeFi Copilot agents.
 *         The Vault consults this contract before executing any agent action.
 */
contract AgentRegistry is Ownable {

    // ─── Types ───────────────────────────────────────────────────────────────

    struct AgentInfo {
        address agentAddress;
        string  name;
        string  description;
        bool    isActive;
        uint256 registeredAt;
        uint256 totalActions;
    }

    // ─── State ───────────────────────────────────────────────────────────────

    mapping(address => AgentInfo) public agents;
    address[]                      public agentList;

    // ─── Events ──────────────────────────────────────────────────────────────

    event AgentRegistered(address indexed agent, string name, uint256 timestamp);
    event AgentRevoked(address indexed agent, uint256 timestamp);
    event AgentReinstated(address indexed agent, uint256 timestamp);
    event ActionRecorded(address indexed agent, uint256 totalActions);

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ─── Owner functions ─────────────────────────────────────────────────────

    /**
     * @notice Register a new authorized agent.
     * @param agent       Agent wallet address.
     * @param name        Human-readable agent name.
     * @param description Agent purpose description.
     */
    function registerAgent(
        address        agent,
        string calldata name,
        string calldata description
    ) external onlyOwner {
        require(agent != address(0),             "AgentRegistry: zero address");
        require(!agents[agent].isActive,         "AgentRegistry: already active");

        agents[agent] = AgentInfo({
            agentAddress: agent,
            name:         name,
            description:  description,
            isActive:     true,
            registeredAt: block.timestamp,
            totalActions: 0
        });
        agentList.push(agent);

        emit AgentRegistered(agent, name, block.timestamp);
    }

    /**
     * @notice Revoke an agent's authorization.
     */
    function revokeAgent(address agent) external onlyOwner {
        require(agents[agent].isActive, "AgentRegistry: not active");
        agents[agent].isActive = false;
        emit AgentRevoked(agent, block.timestamp);
    }

    /**
     * @notice Reinstate a previously revoked agent.
     */
    function reinstateAgent(address agent) external onlyOwner {
        require(agents[agent].registeredAt > 0,  "AgentRegistry: never registered");
        require(!agents[agent].isActive,          "AgentRegistry: already active");
        agents[agent].isActive = true;
        emit AgentReinstated(agent, block.timestamp);
    }

    // ─── View functions ──────────────────────────────────────────────────────

    /**
     * @notice Returns true if the address is a currently authorized agent.
     */
    function isAuthorized(address agent) external view returns (bool) {
        return agents[agent].isActive;
    }

    function getAgentInfo(address agent) external view returns (AgentInfo memory) {
        return agents[agent];
    }

    function getAgentCount() external view returns (uint256) {
        return agentList.length;
    }

    function getAllAgents() external view returns (address[] memory) {
        return agentList;
    }

    // ─── Callable by agent ───────────────────────────────────────────────────

    /**
     * @notice Agent calls this after each successful action to increment its counter.
     */
    function recordAction(address agent) external {
        require(agents[agent].isActive, "AgentRegistry: not active");
        agents[agent].totalActions++;
        emit ActionRecorded(agent, agents[agent].totalActions);
    }
}
