// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./chainlink/AggregatorV3Interface.sol";

contract KingOfTheFools is ReentrancyGuard {
    using Address for address payable;

    uint public constant STAKE_DENOMINATOR = 2;
    uint public constant EXCHANGE_MULTIPLIER = 1e6;

    IERC20 immutable usdc;
    AggregatorV3Interface immutable usdc_eth_priceFeed;

    address payable public currentKingOfFools;
    uint public currentKingStakeEther; // measured in WEI x 1 000 000

    event NewKingOfFools(address newKingOfFools);

    modifier notCurrentKing() {
        require(msg.sender != currentKingOfFools, "You are already the king of fools.");
        _;
    }

    constructor(IERC20 _usdc, AggregatorV3Interface _usdc_eth_priceFeed) {
        usdc = _usdc;
        usdc_eth_priceFeed = _usdc_eth_priceFeed;
    }

    function playWithEther() external payable notCurrentKing nonReentrant {
        if (msg.value == 0) {
            revert("You must deposit some amount of money.");
        }

        if (currentKingOfFools == address(0)) {
            currentKingStakeEther = msg.value * EXCHANGE_MULTIPLIER;
            currentKingOfFools = payable(msg.sender);

            emit NewKingOfFools(msg.sender);
            return;
        }

        if (msg.value * EXCHANGE_MULTIPLIER * STAKE_DENOMINATOR <= currentKingStakeEther * 3) {
            revert("You must deposit 1.5x more money than the previous king.");
        }

        address payable oldKing = _crownNewKing(msg.value * EXCHANGE_MULTIPLIER);
        oldKing.sendValue(msg.value);
    }

    function playWithUSDC(uint usdcToDeposit) external notCurrentKing nonReentrant {
        if (usdcToDeposit == 0) {
            revert("You must deposit some amount of money.");
        }

        if (usdc.allowance(msg.sender, address(this)) < usdcToDeposit) {
            revert("You must first approve this contract to spend your USDC.");
        }

        uint ethToDeposit = usdcToDeposit * _getLatestPrice();

        if (currentKingOfFools == address(0)) {
            currentKingStakeEther = ethToDeposit;
            currentKingOfFools = payable(msg.sender);
            usdc.transferFrom(msg.sender, address(this), usdcToDeposit);

            emit NewKingOfFools(msg.sender);
            return;
        }

        if (ethToDeposit * STAKE_DENOMINATOR <= currentKingStakeEther * 3) {
            revert("You must deposit 1.5x more money than the previous king.");
        }

        address oldKing = _crownNewKing(ethToDeposit);
        usdc.transferFrom(msg.sender, oldKing, usdcToDeposit);
    }

    function _getLatestPrice() internal returns (uint) {
        (uint80 roundID,
        int price,
        uint startedAt,
        uint timeStamp,
        uint80 answeredInRound) = usdc_eth_priceFeed.latestRoundData();

        // 1 USDC = `price` wei
        return uint(price);
    }

    function _crownNewKing(uint newKingStakeEther) internal returns (address payable) {
        currentKingStakeEther = newKingStakeEther;

        address payable oldKing = currentKingOfFools;
        currentKingOfFools = payable(msg.sender);
        emit NewKingOfFools(currentKingOfFools);

        return oldKing;
    }
}
