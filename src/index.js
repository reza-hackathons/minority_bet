import 'regenerator-runtime/runtime'

import { initContract, login, logout } from './utils'
import * as NearApi from 'near-api-js'

import getConfig from './config'
const { networkId } = getConfig(process.env.NODE_ENV || 'development')

const BOATLOAD_OF_GAS = NearApi.utils.format.parseNearAmount("0.0000000003")

let my_bet = {party : "", staked_amount: -1}
let selected_party = ""
let is_signed_in = false

let bet_end_time = 55

const PARTY_JOKER  = "joker"
const PARTY_BATMAN = "batman"

const NEAR_ICON = "Ⓝ"

function selectJoker() {
  $("#jokerBallot").css("border", "dashed .15em")
  $("#batmanBallot").css("border", "")
  selected_party = PARTY_JOKER
}

function selectBatman() {
  $("#batmanBallot").css("border","dashed .15em")
  $("#jokerBallot").css("border", "")
  selected_party = PARTY_BATMAN
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
}

function updateBetBox() {
  let staked_amount = my_bet.staked_amount
  if(my_bet.party == PARTY_JOKER) {
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
    if(selected_party.length == 0) {
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
    bet_end_time = parseInt(stats[2])
    if(bet_end_time > 0) {
      $("#betEndTime").html("Betting ends in " + stats[2] + " minutes.")
      $("#betButton").removeAttr("disabled")      
    }
    else {      
      let bet_start_time = 5 + bet_end_time
      $("#betEndTime").html("Betting starts in " + bet_start_time + " minutes.")
      $("#betButton").attr("disabled", true)
    }
    let joker_staked = parseFloat(NearApi.utils.format.formatNearAmount(stats[0]))
    let joker_summary = "Total: " + joker_staked + " " + NEAR_ICON
    let batman_staked = parseFloat(NearApi.utils.format.formatNearAmount(stats[1]))
    let batman_summary = "Total: " + batman_staked + " " + NEAR_ICON
    if(my_bet.party.length != 0){
      if(my_bet.party == PARTY_JOKER) {
        joker_summary += "<br/>My stake: " + my_bet.staked_amount + " " + NEAR_ICON
        if(joker_staked < batman_staked){
          let share = my_bet.staked_amount / joker_staked * batman_staked
          joker_summary += "<br/>My win: " + share.toFixed(2) + " " + NEAR_ICON
        }
        else{
          joker_summary += "<br/>My loss: " + my_bet.staked_amount + " " + NEAR_ICON
        }
      }
      else {
        batman_summary += "<br/>My stake: " + my_bet.staked_amount + "  " + NEAR_ICON
        if(batman_staked < joker_staked){
          let share = my_bet.staked_amount / batman_staked * joker_staked
          batman_summary += "<br/>My win: " + share.toFixed(5) + "  " + NEAR_ICON
        }
        else{
          batman_summary += "<br/>My loss: " + my_bet.staked_amount + "  " + NEAR_ICON
        }
      }
    }
    $("#jokerSummary").html(joker_summary)
    $("#batmanSummary").html(batman_summary)
  }
  catch(e) {
    console.log(e)
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
    if(is_signed_in) {      
      let v = await window.contract.get_bet({account_id: window.accountId})  
      if(v){
        my_bet.party = v[0]
        my_bet.staked_amount = NearApi.utils.format.formatNearAmount(v[1])
        $("#betButton").html("Pullout")
        updateBetBox()
      }
    }
  }
  catch(e){
    clearBetBox()
    my_bet = {party : "", staked_amount: -1}
    $("#betButton").html("Bet")
  }
  finally{
    if(is_signed_in) {
      fetchAccountInfo()
    }
    fetchOverallStats()
  }
}

$("#maxBalanceButton").click(function(event) {
  event.preventDefault()
  $("#stakeAmountText").val($("#maxBalanceButton").html())
})

function compareWinners(a, b) {
  if(a["payout"] < b["payout"]){
    return -1;
  }
  else if(a["payout"] > b["payout"]){
    return 1;
  }
  else {
    return 0;
  }
}

async function requestRewardPayouts(bets) {
  let overall_stakes = {}
  overall_stakes[PARTY_JOKER] =  0.0
  overall_stakes[PARTY_BATMAN] = 0.0
  for (const account_id of Object.keys(bets)) {
    const bet = bets[account_id]
    overall_stakes[bet[0]] += parseFloat(NearApi.utils.format.formatNearAmount(bet[1]))
  }
  let winners = {}  
  // hence minority wins
  let winning_party = overall_stakes[PARTY_BATMAN] < overall_stakes[PARTY_JOKER] ? PARTY_BATMAN
                                                                                 : PARTY_JOKER 
  let winner_stakes = Math.min(overall_stakes[PARTY_JOKER],
                               overall_stakes[PARTY_BATMAN])
  let cake = Math.max(overall_stakes[PARTY_JOKER],
                      overall_stakes[PARTY_BATMAN])
  let rank = []
  for (const account_id of Object.keys(bets)) {
    const bet = bets[account_id]
    if(bet[0] != winning_party){
      continue;
    }
    let staked_amount = parseFloat(NearApi.utils.format.formatNearAmount(bet[1]))
    let payout = (staked_amount / winner_stakes) * cake
    rank.push({"account_id": account_id,
               "payout": payout})
    winners[account_id] = NearApi.utils.format.parseNearAmount(payout.toString())    
  }
  if(Object.keys(winners).length === 0){
    console.log("No winners.")
    return;
  }
  rank.sort(compareWinners)
  let winnners_rank = {}
  for(let i = 0; i < rank.length; i++){
    let item = rank[i]
    winnners_rank[item["account_id"]] = i
  }
  let params = {"winners": winners,
                "winners_rank": winnners_rank}
  try {
    let res = await contract.distribute_rewards(
                      params,
                      BOATLOAD_OF_GAS)
    console.log("Rewards distributed: " + res)
  }
  catch(e) {
    console.log(e)
  }
}

async function initiatePayouts(bets) {
  if(is_signed_in && bet_end_time < 0) {
    requestRewardPayouts(bets)
  }  
}


async function bet(ballot) {
  try {
    let res = await window.contract.bet(
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
    console.log(e)
  }
  finally {
    location.reload()
    fetchMyBet()
  }

}

function pollTimerCallback() {    
  fetchMyBet()
}

async function rewardTimerCallback() {
  try {
    let bets = await contract.get_all_bets()
    initiatePayouts(bets)

  }
  catch(e){
    console.log(e)
  }
}

function signedOutFlow() {
  $("#walletMessage").html("To make a bet, please connect your wallet.")
  is_signed_in = false
}

function signedInFlow() {  
  fetchMyBet()
  is_signed_in = true
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
    var poll_timer = setInterval(pollTimerCallback, 30 * 1000); 
    pollTimerCallback()
    var reward_timer = setInterval(rewardTimerCallback, 2 * 60 * 1000);
  })
  .catch(console.error)
