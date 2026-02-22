// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockToken
 * @notice Testnet ERC-20 token with a public faucet for DeFi Copilot demos.
 *         Deploy as "Mock ETH" (mETH) — 18 decimals, matches Vault config.
 *
 * Deploy args:
 *   name_    → "Mock ETH"
 *   symbol_  → "mETH"
 *
 * After deploy:
 *   1. mint(yourWallet, 1_000_000 * 1e18)  ← give yourself initial supply
 *   2. Use this contract address as _depositToken in Vault.sol
 */
contract MockToken is ERC20, Ownable {

    // ── Config ──────────────────────────────────────────────────────────────

    uint256 public constant FAUCET_AMOUNT   = 100  * 1e18;   // 100 tokens per drip
    uint256 public constant FAUCET_COOLDOWN = 24 hours;
    uint256 public constant MAX_SUPPLY      = 100_000_000 * 1e18; // 100 M cap

    // ── State ────────────────────────────────────────────────────────────────

    mapping(address => uint256) public lastFaucetTime;
    bool public faucetEnabled = true;

    // ── Events ───────────────────────────────────────────────────────────────

    event Faucet(address indexed recipient, uint256 amount, uint256 timestamp);
    event FaucetToggled(bool enabled);

    // ── Constructor ──────────────────────────────────────────────────────────

    constructor(
        string memory name_,
        string memory symbol_
    ) ERC20(name_, symbol_) Ownable(msg.sender) {}

    // ── Public faucet ────────────────────────────────────────────────────────

    /**
     * @notice Anyone can call this once every 24 hours to receive FAUCET_AMOUNT tokens.
     */
    function faucet() external {
        require(faucetEnabled, "MockToken: faucet disabled");
        require(
            block.timestamp >= lastFaucetTime[msg.sender] + FAUCET_COOLDOWN,
            "MockToken: cooldown active - wait 24h"
        );
        require(
            totalSupply() + FAUCET_AMOUNT <= MAX_SUPPLY,
            "MockToken: max supply reached"
        );

        lastFaucetTime[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);

        emit Faucet(msg.sender, FAUCET_AMOUNT, block.timestamp);
    }

    /**
     * @notice Owner can mint any amount to any address (for seeding liquidity).
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(totalSupply() + amount <= MAX_SUPPLY, "MockToken: max supply reached");
        _mint(to, amount);
    }

    /**
     * @notice Owner can toggle the public faucet on/off.
     */
    function toggleFaucet(bool enabled) external onlyOwner {
        faucetEnabled = enabled;
        emit FaucetToggled(enabled);
    }

    /**
     * @notice How many seconds until a given address can use the faucet again.
     */
    function faucetCooldownRemaining(address user) external view returns (uint256) {
        uint256 nextAllowed = lastFaucetTime[user] + FAUCET_COOLDOWN;
        if (block.timestamp >= nextAllowed) return 0;
        return nextAllowed - block.timestamp;
    }
}
