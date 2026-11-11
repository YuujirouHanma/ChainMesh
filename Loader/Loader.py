from Controller import BlockChainDisplay, NetworkController, NodeController, TransactionController
from View import MenuView


def LoadView(loc):
    match loc:
        case "1":
            TransactionController.Control()
        case "2":
            TransactionController.History()
        case "3":
            BlockChainDisplay.Control()
        case "4":
            NetworkController.Control()
        case "5":
            NodeController.RestoreWallet()
        case "0":
            NodeController.ShowWallet()
        case _:
            print("Error : Invalid Menu Command")


def Run():
    """Loop menu utama (versi lama memakai rekursi LoadView <-> MenuView)."""
    while True:
        try:
            choice = MenuView.Main()
            if choice == "q":
                if _confirm_exit():
                    return
            elif choice is not None:
                LoadView(choice)
        except KeyboardInterrupt:
            if _confirm_exit():
                return
        except EOFError:
            print("\nInput closed. Goodbye! ^^")
            return
        except Exception as error:
            print("An Error Occured :", error)


def _confirm_exit():
    try:
        answer = input("\n Exit the Program? [y/N] :").strip().lower()
    except (KeyboardInterrupt, EOFError):
        answer = "y"
    if answer == "y":
        print("Goodbye! ^^")
        return True
    return False
