// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestERC20 is ERC20 {
    constructor() ERC20("TestERC20", "TEC") {
        _mint(msg.sender, type(uint256).max);
    }

    function decimals() public view override returns (uint8) {
        return 6;
    }
}
