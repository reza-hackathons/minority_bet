Minority Bet Zoo
=================

Minority Bet Zoo is a binary(2-choice) betting game that challenges participants's strategis to make difficult choices in order to win. It simply asks users to stake some near tokens, choose a party, and finally wait for the winners to be chosen and rewards distribution. Users who wish to win, are expected to stake their tokens in a party whose total staked funds is **minimal**.  

Each betting session runs for an _hour_, during the first _55_ minutes bettors have a chance to make a bet and then there is a _5_ minutes cooldown period where the winners are chosen and reward payouts are made. Betting starts when the minute handle of the blockchain's clock is 0 and ends when the handle reaches 56, with the remaining 5 minutes(56 to 59) reserved for cooldown, payouts, and internal chores.  

Two parties(**Batman** and **Joker**) are presented to the users to choose from along with the funds they wish to bet on. Once a bet is made, the profit/loss is presented to the user to let her know what is going to happen. Users are able to pull out of the game and bet again as long as the betting is alive(minute handle <= 55).  

A typical betting games asks the users to bet on some random and unknown outcome and once the outcome is known those who made the right choice are awarded. Here we take a different approach, there is no to be known outcome, and we ask our users to pick the party whose funds is minimal if they wish to win, **hence the minority bet**. This is *counter-intuitive* as people are incetivized to maximize their gains and the natural expectation would have been to ask them to pick the party with the higher amounts staked. In situations like this, people get confused as they are asked to put their faith in the minority party. Putting funds into a bet is *positive factor* and choosing a minority party is a *negative one*, therefore, we are applying a *cancel out* factor. This is similar to the funding scheme is perpetual contracts that makes it *unsutainable* for the market to stay one-sided for long times. Another benefit is the immunity of our scheme to large market movers aka **whales**. A whale could easily manipulate a majority bet system by staking its funds in a party and suck in the funds. but, in a minority bet this is literally impossible. To win, a whale has to choose the minimal party and once it puts his large bag in that party, the party is no longer the minimal one. So, market manipulation becomes difficult and demands complex strategies which often lead to big losses.  

The system relies on users' **honesty** to operate. There is no governing body to choose the winners and users themselves regulate the sessions's outcomes. Once the betting is finished, every users gets all the bets and calculates and submits a winners list to the smart contract. The smart contract then performs some security and integrity checks and makes the payouts. Every user is expected to send the winners list along with the rank of every winner in winner party's payput pool. The smart contract rankes its own version of the winners and compares its list with the proposed one and rejcets immediately if discrepancies are discovered. This way users are encouraged to submit a correct record, at least those who wish to get their rewards. If no winners list is received by the smart contract, or all the funds are staked within a party, or a draw has happened, then the betting session is extended to the next hour. 

Math behind
=================
The rules of winning and reward distribution is simple.  
Parties: (Joker, Batman)  
JokerStaked = the amount of funds bet on Joker  
BatmanStaked = the amount of funds bet on Batman  
WinningParty = party of argMin(JokerStaked, BatmanStaked)  
Cake = argMax(JokerStaked, BatmanStaked)  
ShareOfTheCakeForBettor = ('amount staked on the minority party' / 'total amount staked on the minority party') * Cake  
Payout = 'amount staked on the minority party' + ShareOfTheCakeForBettor  

Demo
=================
A live version is available on [skynet](https://siasky.net/fAMI7iFQqWOh4OvNE14wOq0Bu4Nas0vV_tjZlsIOc4dt7w).

A demo is video taped here which demostrates a typical betting session.  
[Skynet](https://siasky.net/AADmyAnPiqE8-AqkDZLFShue-y4BGcepS0UdijUL9L8jnA)  
[Youtube](https://youtu.be/qyLW3g4-Z9E)  


How to run
=================
1. Clone the repository  
2. [Have a working Near account](https://docs.near.org)
3. `yarn install`  
4. `npm run dev`  

Warning  
=================  
This is just a demonstration of a possible transparent betting/election process. Please be very cautious as there might be security bugs within the smart contract logic.


References
=================
[NEAR blockchain](https://near.org)  
[Skynet](https://siasky.net)  
[Gitcoin](https://gitcoin.co)

License
=================
MIT
