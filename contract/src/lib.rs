
// To conserve gas, efficient serialization is achieved through Borsh (http://borsh.io/)
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::wee_alloc;
use near_sdk::{env, near_bindgen, AccountId, Promise};
use std::collections::HashMap;
use std::cmp;
use std::convert::TryInto;

#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[derive(Debug, BorshDeserialize, BorshSerialize, PartialEq)]
pub enum Party {
    Invalid = 0,
    Joker,
    Batman,
}

#[derive(BorshDeserialize, BorshSerialize)]
pub struct Ballot {
    party: Party,
    staked_amount: u128,    
}

#[near_bindgen]
#[derive(Default, BorshDeserialize, BorshSerialize)]
pub struct Bet {
    bets: HashMap<AccountId, Ballot>,
}

#[near_bindgen]
impl Bet {

    fn get_cur_min(&self) -> u8 {
        let secs_from_epoch = env::block_timestamp() / 1000000000;
        ((secs_from_epoch / 60) % 60).try_into().unwrap()
    }

    fn accepting_bets(&self) -> bool {
        self.get_cur_min() <= 55                 
    }

    #[payable]
    pub fn bet(&mut self, p: String) {
        assert!(self.accepting_bets(),
                "We are cooling down, please try again a few minutes later.");
        let account_id = env::signer_account_id();
        assert!(!self.bets.contains_key(&account_id),
                "Already bet.");
        let staked_amount = env::attached_deposit();
        assert!(staked_amount > 0,
               "Insufficient deposit.");
        let chosen_party = match p.as_str() {
            "joker"  => Party::Joker,
            "batman" => Party::Batman,
            _ => Party::Invalid,
        };
        assert!(chosen_party != Party::Invalid,
                "Invalid party chosen.") ;       
        self.bets.insert(account_id,
                         Ballot {party: chosen_party,
                                 staked_amount : staked_amount,
                                 });
    }

    pub fn get_bet(&self, account_id: AccountId) -> (String, String) {
        assert!(self.bets.contains_key(&account_id),
               "No such bet found.");
        let ballot = self.bets.get(&account_id).unwrap();        
        (match ballot.party {
            Party::Joker => "joker".to_string(),
            _ => "batman".to_string(),
         },
         ballot.staked_amount.to_string())
    }

    pub fn pullout(&mut self) {
        assert!(self.accepting_bets(),
                "We are cooling down, please try again a few minutes later.");
        let account_id = env::signer_account_id();
        assert!(self.bets.contains_key(&account_id),
               "Failed to pullout: no such bet found.");
        let ballot = self.bets.remove(&account_id).unwrap();
        Promise::new(account_id.to_string())
                    .transfer(ballot.staked_amount);
    }

    fn count_stakes(&self) -> (u128, u128) {
        let mut joker_staked: u128 = 0;
        let mut batman_staked: u128 = 0;
        for (_, ballot) in &self.bets {
            if ballot.party == Party::Joker {
                joker_staked += ballot.staked_amount;
            }
            else {
                batman_staked += ballot.staked_amount;
            }            
        }
        (joker_staked, batman_staked)
    }
    // retrive joker + batman stakes and remaining time of the bet
    pub fn get_overall_stats(&self) -> (String, String, i8) {
        let (joker_staked, batman_staked) = self.count_stakes();
        (joker_staked.to_string(),
         batman_staked.to_string(),
         55 - (self.get_cur_min() as i8))
    }

    pub fn get_all_bets(&self) -> HashMap<String, (String, String)> {     
        let mut all_bets: HashMap<String, (String, String)> = HashMap::new();
        for (account_id, ballot) in &self.bets {
            all_bets.insert(account_id.to_string(),
                            (match ballot.party {
                                Party::Joker => "joker".to_string(),
                                _ => "batman".to_string(),
                             }, ballot.staked_amount.to_string()));
        }
        all_bets
    }

    fn do_ranks_match(&self, winners_rank: HashMap<String, u32>) -> bool {
        let mut internal_rank: Vec<(String, u128)> = Vec::new();
         for (account_id, _) in &winners_rank {
            internal_rank.push((account_id.to_string(),
                                self.bets.get(account_id).unwrap().staked_amount));
         } 
         internal_rank.sort_by(|a, b| a.1.cmp(&b.1));
         let mut i: u32 = 0;
         for real_rank in internal_rank.iter() {
            let req_rank = winners_rank.get(&real_rank.0).unwrap();
            if *req_rank != i {
                return false;
            }
            i += 1;
         }
         return true;
    }

    pub fn distribute_rewards(&mut self,
                              cake: String,
                              winners: HashMap<String, String>,
                              winners_rank: HashMap<String, u32>) {
        assert!(!self.accepting_bets(),
                "Betting is still going on.");
        assert!(self.bets.len() > 0,
                "No bets found or rewards already distributed.");
        // safety checks
        // - we should have a winner 
        let (joker_staked, batman_staked) = self.count_stakes();
        assert!((joker_staked != 0) && (batman_staked != 0),
                "All funds staked on a single party, betting resumes.");
        // - draws not allowed
        assert!(batman_staked != joker_staked,
                "No winning party, betting resumes.");            
        let mut winning_party = Party::Joker;
        if batman_staked < joker_staked {
            winning_party = Party::Batman;
        }
        // - requested winners list = internal list
        for (account_id, _) in &winners {
            assert!(self.bets.contains_key(account_id),
                    "'{}' not in the winners list anymore.",
                    account_id);                
            let real_party = &self.bets.get(account_id).unwrap().party;
            assert_eq!(*real_party,
                       winning_party,
                       "'{}' is not a winner.",
                       account_id);
        }
        // - cake = the sum of losers' stake
        let real_cake = cmp::max(joker_staked, batman_staked);
        assert_eq!(real_cake,
                   u128::from_str_radix(&cake, 10).unwrap(),
                   "total payout of {} not equal to the one we have {}.",
                   cake,
                   real_cake);
        // - winners' rank  = internal winners' rank, this is to ensure a winner
        //   gets the right amount of shares
        assert!(self.do_ranks_match(winners_rank),
                "Requested payouts are inconsistent.");
        // pay 'em all
        for (account_id, amount) in &winners {                
            let payout = u128::from_str_radix(amount, 10).unwrap();
            self.bets.remove(account_id);
            Promise::new(account_id.to_string())
                .transfer(payout);
            env::log(format!("payout of {} => '{}'",
                             payout,
                             account_id,
                             ).as_bytes())
        }
        self.bets.clear();
    }
}

/*
 * The rest of this file holds the inline tests for the code above
 * Learn more about Rust tests: https://doc.rust-lang.org/book/ch11-01-writing-tests.html
 *
 * To run from contract directory:
 * cargo test -- --nocapture
 *
 * From project root, to run in combination with frontend tests:
 * yarn test
 *
 */
#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::MockedBlockchain;
    use near_sdk::{testing_env, VMContext};

    // mock the context for testing, notice "signer_account_id" that was accessed above from env::
    fn get_context(input: Vec<u8>, is_view: bool) -> VMContext {
        VMContext {
            current_account_id: "alice_near".to_string(),
            signer_account_id: "bob_near".to_string(),
            signer_account_pk: vec![0, 1, 2],
            predecessor_account_id: "carol_near".to_string(),
            input,
            block_index: 0,
            block_timestamp: 0,
            account_balance: 0,
            account_locked_balance: 0,
            storage_usage: 0,
            attached_deposit: 0,
            prepaid_gas: 10u128.pow(18),
            random_seed: vec![0, 1, 2],
            is_view,
            output_data_receivers: vec![],
            epoch_height: 19,
        }
    }
}
