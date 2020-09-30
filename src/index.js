import 'regenerator-runtime/runtime'

import { initContract, login, logout } from './utils'
import * as NearApi from 'near-api-js'

import getConfig from './config'
const { networkId } = getConfig(process.env.NODE_ENV || 'development')

const BOATLOAD_OF_GAS = NearApi.utils.format.parseNearAmount("0.0000000003")

let my_bet = {party : "", staked_amount: -1}
let selected_party = ""


function selectJoker() {
  $("#jokerBallot").css("border", "dashed .15em")
  $("#batmanBallot").css("border", "")
  selected_party = "joker"
}

function selectBatman() {
  $("#batmanBallot").css("border","dashed .15em")
  $("#jokerBallot").css("border", "")
  selected_party = "batman"
}

$("#jokerBallot").click( function(event) {
  event.preventDefault()
  if(my_bet.party.length == 0) {
    selectJoker()
  }
})

$("#batmanBallot").click(function(event) {
  if(my_bet.party.length == 0) {
    event.preventDefault()
    selectBatman()
  }
})

function clearBetBox() {
  $("#stakeAmountText").val("")
  $("#jokerBallot").css("border", "")
  $("#batmanBallot").css("border", "")
  selected_party = ""
}

function updateBetBox() {
  let staked_amount = my_bet.staked_amount
  if(my_bet.party == "joker") {
    selectJoker()
    $("#jokerAmountStaked").html(staked_amount)
  }
  else {
    selectBatman()
    $("#batmanAmountStaked").html(staked_amount)
  }
}

$("#betButton").click(function() {
  if($(this).html() == "Bet"){
    if(selected_party < 0) {
      console.log("Select either the Joker or the Batman box first.")
      return
    }
    let amount = $("#stakeAmountText").val()
    if(amount.length == 0 || isNaN(parseFloat(amount))) {
      console.log("Invalid stake amount.")
      return
    }

    let ballot = {party: selected_party, staked_amount: amount}
    bet(ballot)
  }
  else {
    if(my_bet.party.length == 0){
      console.log("Can't pullout.")
      return
    }
    pullout()
  }
})


$("#connectWalletButton").click(function() {
  if (window.walletConnection.isSignedIn()) {
    logout()
    signedOutFlow()
  }
  else {
    login()
    signedInFlow()
  }
})


async function fetchOverallStats() {
  try {
    let stats = await window.contract.get_overall_stats()
    let bet_end_time = parseInt(stats[2])
    if(bet_end_time > 0) {
      let joker_staked = parseFloat(NearApi.utils.format.formatNearAmount(stats[0]))
      $("#totalJokerStaked").html("TotalStaked: " + joker_staked + "  Ⓝ")
      let batman_staked = parseFloat(NearApi.utils.format.formatNearAmount(stats[1]))
      $("#totalBatmanStaked").html("Total staked: " + batman_staked + "  Ⓝ")
      $("#betEndTime").html("Betting will end in ~<u>" + stats[2] + "</u> minute(s).")
      $("#betButton").removeAttr("disabled")
      $("#betBox").css("display", "block")
      if(my_bet.party.length != 0){
        if(my_bet.party == "joker") {
          $("#myJokerStaked").html("My stake: " + my_bet.staked_amount + "  Ⓝ")
          $("#myBatmanStaked").html("")

        }
        else {
          $("#myBatmanStaked").html("My stake: " + my_bet.staked_amount + "  Ⓝ")
          $("#myJokerStaked").html("")
        }
      }
      else {
        $("#myJokerStaked").html("")
        $("#myBatmanStaked").html("")
      }
    }
    else {
      $("#totalJokerStaked").html("")
      $("#totalBatmanStaked").html("")
      let bet_start_time = 5 + bet_end_time
      $("#betEndTime").html("Payouts being sent, beeting starts in ~<u>" + bet_start_time + "</u> minute(s).")
      $("#betButton").attr("disabled", true)
      $("#betBox").css("display", "none")
      $("#bettingSummary").html("")
    }
  }
  catch(e) {
    console.log("Failed to fetch overall stats.\n" + e)
  }  
}

async function fetchAccountInfo() {
  $("#walletMessage").html("Welcome '" + window.accountId + "'")
  let balance = await window.contract.account.getAccountBalance()
  let near_balance = NearApi.utils.format.formatNearAmount(balance.available)
  let dot_pos = near_balance.indexOf(".") 
  near_balance = dot_pos > 0 ? near_balance.substr(0, dot_pos + 6)
                             : near_balance
  // console.log("balance: " + near_balance)
  // console.log(balance)
  // @ possible bug in near-api-js: when we pullout and then ask the engine asap
  // to update our balance it still goes with the same amount 
  $("#maxBalanceButton").html(near_balance)  
}

async function fetchMyBet() {
  try {
    let v = await window.contract.get_bet({account_id: window.accountId})  
    if(v){
      my_bet.party = v[0]
      my_bet.staked_amount = NearApi.utils.format.formatNearAmount(v[1])
      $("#betButton").html("Pullout")
      updateBetBox()
    }
  }
  catch(e){
    clearBetBox()
    my_bet = {party : "", staked_amount: -1}
    $("#betButton").html("Bet")
    console.log("You may have not bet or there are some problems. \n" + e)
    throw e      
  }
  finally{
    fetchAccountInfo()
    fetchOverallStats()
  }
}

$("#maxBalanceButton").click(function(event) {
  event.preventDefault()
  $("#stakeAmountText").val($("#maxBalanceButton").html())
})

async function distributeRewards(bets) {
  let overall_stakes = {"joker": 0.0, "batman" : 0.0}
  for (const account_id of Object.keys(bets)) {
    const bet = bets[account_id]
    overall_stakes[bet[0]] += parseFloat(NearApi.utils.format.formatNearAmount(bet[1]))
  }
  console.log(bets)
  // hence minority wins
  let winners = {}  
  let winning_party = overall_stakes["batman"] < overall_stakes["joker"] ? "batman"
                                                                         : "joker" 
  // console.log(winning_party)
  let winner_stakes = Math.min(overall_stakes["joker"], overall_stakes["batman"])
  // console.log(winner_stakes)
  let cake = Math.max(overall_stakes["joker"], overall_stakes["batman"])
  // console.log(cake)
  for (const account_id of Object.keys(bets)) {
    const bet = bets[account_id]
    if(bet[0] != winning_party){
      continue;
    }
    let staked_amount = parseFloat(NearApi.utils.format.formatNearAmount(bet[1]))
    let payout = staked_amount + (staked_amount / winner_stakes) * cake
    winners[account_id] = NearApi.utils.format.parseNearAmount(payout.toString())    
  }
  console.log(winners)
  try {
    let res = await contract.distribute_rewards({"winners": winners}, BOATLOAD_OF_GAS)
  }
  catch(e) {
    console.log("Failed to request reward payouts.\n", e)
  }
}

async function fetchAllBets() {
  try {
      let bets = await contract.get_all_bets()
      distributeRewards(bets)
    }
    catch(e){
      console.log("Could not retrieve bettors' data.\n" + e)
    }
}


async function bet(ballot) {
  let res;
  try {
    res = await window.contract.bet(
                  {"p": ballot.party}, 
                  BOATLOAD_OF_GAS,                 
                  NearApi.utils.format.parseNearAmount(ballot.staked_amount))
  }
  catch(e) {
    console.log(e)
    throw e
  }
  finally {    
    fetchMyBet()
  }
}

async function pullout() {
  try {
    let res = await window.contract.pullout(
                      {},
                      BOATLOAD_OF_GAS)

  }
  catch(e) {
    console.log("Failed to pullout.\n" + e)
  }
  finally {
    fetchMyBet()
  }

}

function pollTimerCallback() {    
    fetchMyBet()
}

function rewardTimerCallback() {
  fetchAllBets()
}

function signedOutFlow() {
  $("#walletMessage").html("To make a bet, please connect your wallet.")
  $("#betButton").attr("disabled", true)
}

function signedInFlow() {  
  fetchMyBet()
  $("betButton").removeAttr("disabled");
}

// `nearInitPromise` gets called on page load
window.nearInitPromise = initContract()
  .then(() => {
    if (window.walletConnection.isSignedIn()) {
      signedInFlow() 
      $("#connectWalletButton").html("Disconnect")
    }
    else {
      signedOutFlow()
      $("#connectWalletButton").html("Connect")
    }
    var poll_timer = setInterval(pollTimerCallback, 20 * 1000); // every 20 sec
    pollTimerCallback()
    // var reward_timer = setInterval(rewardTimerCallback, 2 * 60 * 1000); // every 2 minutes
  })
  .catch(console.error)
