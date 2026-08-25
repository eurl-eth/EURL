// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title EURL Piggy Bank - 链上存钱罐 + calldata 接收合约
/// @notice 用于承载 "EURL:U1:<url>" 数据（fallback 接受任意 calldata），
///         同时作为小费存钱罐（payable receive 接收 value）。
///         规避钱包对 EOA/零地址 + data 的拦截。
/// @dev 部署后把地址填入对应链配置的 tipAddress；拥有者可随时提取余额。
contract PiggyBank {
    address public immutable owner;

    constructor() {
        owner = msg.sender;
    }

    fallback() external payable {}

    receive() external payable {}

    /// @notice 提取全部余额给指定地址
    function withdraw(address payable to) external {
        require(msg.sender == owner, 'not owner');
        (bool ok, ) = to.call{ value: address(this).balance }('');
        require(ok, 'withdraw failed');
    }
}
