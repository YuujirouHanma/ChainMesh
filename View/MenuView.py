MENU = '''
    --- Menu ---
    1. Create Transaction
    2. Get Transaction History
    3. Get Local Block-Chain Data
    4. Network Peers (view / add / remove)
    5. Restore Wallet from Seed
    0. Return to main Menu (wallet info)
    q. Exit
'''
CHOICES = {"1", "2", "3", "4", "5", "0", "q"}


def Main():
    """Tampilkan menu dan kembalikan pilihan yang valid, atau None jika input tidak dikenal."""
    print(MENU)
    choice = input("Choose Menu [1/2/3/4/5/0/q] :").strip().lower()
    if choice not in CHOICES:
        print("Error : Invalid Menu Command")
        return None
    return choice
