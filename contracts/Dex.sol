// SPDX-License-Identifier: MIT
pragma solidity >=0.8.13;
pragma experimental ABIEncoderV2;
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';

contract Dex {

    using SafeMath for uint;

    enum Trade {
        BUY,
        SELL
    }

    struct Token {
        bytes32 symbol;
        address tokenAddress;
    }

    struct Order {
        uint id;
        address trader;
        Trade trade;
        bytes32 symbol;
        uint amount;
        uint filled;
        uint price;
        uint date;
    }

    mapping(bytes32 => Token) public tokens;
    bytes32[] public tokenList;
    mapping(address => mapping(bytes32 => uint)) public traderBalances;
    mapping(bytes32 => mapping(uint => Order[])) public orderBook;
    address public admin;
    uint public nextOrderId;
    uint public nextTradeId;
    bytes32 constant DAI = bytes32('DAI');

    event NewTrade(
        uint tradeId,
        uint orderId,
        bytes32 indexed symbol,
        address indexed trader1,
        address indexed trader2,
        uint amount,
        uint price,
        uint date
    );


    modifier onlyAdmin() {
        require (msg.sender == admin, 'Only Admin');
        _;
    }

    modifier tokenExists(bytes32 symbol) {
        require (tokens[symbol].tokenAddress != address(0), 'Token exists');
        _;
    }

    modifier isNotDai(bytes32 symbol) {
        require(symbol != DAI, 'Not possible to trade with DAI');
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function getOrders(bytes32 symbol, Trade trade) external view returns(Order[] memory) {
        return orderBook[symbol][uint(trade)];
    }

    function getTokens() external view returns(Token[] memory) {
      Token[] memory _tokens = new Token[](tokenList.length);
      for (uint i = 0; i < tokenList.length; i++) {
        _tokens[i] = Token(
          tokens[tokenList[i]].symbol,
          tokens[tokenList[i]].tokenAddress
        );
      }
      return _tokens;
    }

    function addToken(bytes32 symbol,address tokenAddress) external onlyAdmin() {
        tokens[symbol] = Token(symbol, tokenAddress);
        tokenList.push(symbol);

    }

    function deposit(uint amount, bytes32 symbol) external {
        IERC20(tokens[symbol].tokenAddress).transferFrom(
            msg.sender,
            address(this),
            amount
        );
        traderBalances[msg.sender][symbol] = traderBalances[msg.sender][symbol].add(amount);
    }

    function withdraw(uint amount, bytes32 symbol) external tokenExists(symbol) {
        require(traderBalances[msg.sender][symbol] >= amount, 'Not enough balance to withdraw');

        traderBalances[msg.sender][symbol] = traderBalances[msg.sender][symbol].sub(amount);
        IERC20(tokens[symbol].tokenAddress).transfer(
            msg.sender,
            amount
        );

    }
    

    function createLimitOrder(bytes32 symbol, uint amount, uint price, Trade trade) external tokenExists(symbol) isNotDai(symbol) {
        

        if (trade == Trade.SELL) {
            require(traderBalances[msg.sender][symbol] >= amount, 'Not enough tokens to sell');
        }

        else {
            require(traderBalances[msg.sender][DAI] >= amount.mul(price), 'Not enough DAI to complete the transaction');
        }

        Order[] storage orders = orderBook[symbol][uint(trade)];

        orders.push(Order(
            nextOrderId,
            msg.sender,
            trade,
            symbol,
            amount,
            0,
            price,
            block.timestamp
        ));

        uint i = orders.length > 0 ? orders.length - 1 : 0;

        while (i > 0) {

            if (trade == Trade.BUY && orders[i - 1].price > orders[i].price) {
                break;
            } 

            if (trade == Trade.SELL && orders[i - 1].price < orders[i].price) {
                break;
            }

            Order memory order = orders[i - 1];
            orders[i - 1] = orders[i]; 
            orders[i] = order;
            i = i.sub(1);
        }

        nextOrderId = nextOrderId.add(1);



    }


    function createMarketOrder(bytes32 symbol, uint amount,Trade trade) external tokenExists(symbol) isNotDai(symbol) {

        if (trade == Trade.SELL) {
            require(traderBalances[msg.sender][symbol] >= amount, 'Not enough tokens to sell');
        }

        Order[] storage orders = orderBook[symbol][uint(trade == Trade.SELL ? Trade.BUY : Trade.SELL)];
        uint i;
        uint remaining = amount;

        while (i < orders.length && remaining > 0) {
            uint available = orders[i].amount.sub(orders[i].filled);
            uint matched = (remaining > available) ? available : remaining;
            remaining = remaining.sub(matched);
            orders[i].filled = orders[i].filled.add(matched);
            address trader = orders[i].trader;

            emit NewTrade(
                nextTradeId,
                orders[i].id,
                symbol,
                trader,
                msg.sender,
                matched,
                orders[i].price,
                block.timestamp
            );

            if (trade == Trade.SELL) {
                traderBalances[msg.sender][symbol] = traderBalances[msg.sender][symbol].sub(matched);
                traderBalances[msg.sender][DAI] = traderBalances[msg.sender][DAI].add(orders[i].price.mul(matched));
                traderBalances[trader][symbol] = traderBalances[trader][symbol].add(matched);
                traderBalances[trader][DAI] = traderBalances[trader][DAI].sub(orders[i].price.mul(matched));
            }

            if (trade == Trade.BUY) {

                require(traderBalances[msg.sender][DAI] >= orders[i].price.mul(matched), 'Not enough DAI in balance');

                traderBalances[msg.sender][symbol] = traderBalances[msg.sender][symbol].add(matched);
                traderBalances[msg.sender][DAI] = traderBalances[msg.sender][DAI].sub(orders[i].price.mul(matched));
                traderBalances[trader][symbol] = traderBalances[trader][symbol].sub(matched);
                traderBalances[trader][DAI] = traderBalances[trader][DAI].add(orders[i].price.mul(matched));
            }
            nextTradeId = nextTradeId.add(1);
            i = i.add(1);

        }

       i = 0;

       while (i < orders.length && orders[i].filled == orders[i].amount) {
           for(uint j = i; j < orders.length; j++) {
               orders[j] = orders[j+1];
           }
           orders.pop();
           i = i.add(1);
       }
    }

}