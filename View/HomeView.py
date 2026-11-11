def Main(seed, publicKey, nodeAddress=""):
    print("\nWelcome ... To Wallet")
    if seed:
        print(f'''
    Your SEEDS
    Notes : (Please remember / copy this mnemonic to another file.
             It is the only way to restore this wallet, see menu 5)

    SEED = {seed}
''')
    print(f'''
    YOUR PUBLIC KEY

    PUBLIC KEY   = {publicKey}
    NODE ADDRESS = {nodeAddress}
''')


def AskSeed():
    return input("Enter your 24-word seed (empty = cancel): ").strip()


def Confirm(question):
    return input(f"{question} [y/N] : ").strip().lower() == "y"
