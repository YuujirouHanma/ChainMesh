start_program(){
    Multi-Processing (3 terminals, opened by __executer__.py){
    Process1 : Start WebsocketServer {
        accept peer connections (hello -> welcome handshake, measure latency, record peer)
        broadcast every block in Buffer/WaitBox.json to all connected peers at once
        serve /get-blockchaindata (local chain is verified & repaired before it is sent)
    }
    Process2 : Start WebsocketClient {
        connect to ALL known peers concurrently (complete graph), reconnect automatically
        learn new peers from every welcome message
        receive blocks -> receive_block
    }
    Process3 : initiate_node {
        store Node Address to Node Database
        (Credential Initiated ? [Yes] -> next , [No] -> Generate Private Key and Public Key, store to Node Database, show the 24-word seed once)
        Verify the local chain (drop invalid blocks), then synchronize from the nearest peer
        (lowest latency, backtrack to the next nearest peer if it is offline or its chain is invalid)
        Choose Menu :
        1. Create Transaction
        2. Get Transaction History
        3. Get Local Block-Chain Data
        4. Network Peers (view / add / remove)
        5. Restore Wallet from Seed
        0. Return to main Menu (wallet info)
        q. Exit
    }
    }
}

create_transaction{
    Enter the Receiver ID
    Enter the Message
    Verify the Local BlockChain (drop invalid blocks), then synchronize with the nearest online peer
    Sign (message + timeStamp) with the private key
    Mine The Block (find a nonce so that the hash starts with DIFFICULTY zero bits)
    add The Block to local BlockChain Data
    Put the block in Buffer/WaitBox.json -> the WebSocket Server broadcasts it
}

receive_block{
    already in the chain                    -> ignore
    extends the last block and is valid     -> add, forward to other peers
    fork (same prev_hash as a local block)  -> the block with the largest proof_of_work wins
                                               (tie: smallest hash); if the peer's block wins -> synchronize
    peer chain is longer / unknown parent   -> synchronize from that peer
    invalid                                 -> reject
}
