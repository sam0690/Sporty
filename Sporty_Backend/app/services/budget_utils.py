from decimal import Decimal

TRANSACTION_PENALTY = Decimal("0.10")


def calculate_refund(player_cost: Decimal) -> tuple[Decimal, Decimal]:
    """Return (refund_amount, penalty_applied) for budget-mode discard/transfer out.

    Refund is player_cost minus a fixed transaction penalty, clamped at zero.
    """
    penalty = TRANSACTION_PENALTY
    refund = player_cost - penalty
    if refund < Decimal("0.00"):
        refund = Decimal("0.00")
    return refund, penalty
