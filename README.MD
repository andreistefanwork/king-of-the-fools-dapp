# King of the fools

## Problem description

- Anyone can deposit ether or USDC into a smart contract, as long as it's at least 1.5x more money than the previous person.
- If you do that, you become "King of the fools", and your money gets sent back to the previous person.

Example:
1. Smart contract is empty
2. First person deposits 1 ETH there, nobody gets anything
3. Second person deposits 1.51 ETH there, the first person receives 1.51 ETH
4. Third person deposits 2290 USDC (suppose 1 ether == 1000 USDC), the second person receives 2290 USDC
5. ...

To do: write the smart contract + a simple UI that interacts with the contract.


## Development

### Client development

- simple React app that interacts with the smart contract


### Smart contract development

- Smart contract is developed using Solidity
- Testing / deployment is facilitated by the use of Hardhat
