from django.db import transaction

from .models import Order, OrderEvent

# Transiciones válidas según spec sección 3.2. Los tres estados
# alternativos (cancelado, sin_stock, rechazado) son terminales; no
# están todos habilitados desde cualquier estado porque no tiene
# sentido, por ejemplo, "rechazar" un pedido que ya está en camino --
# eso es una decisión de diseño de esta implementación, la spec no
# detalla desde qué estados se puede llegar a cada uno.
TRANSITIONS = {
    Order.ESTADO_PENDIENTE: {
        Order.ESTADO_CONFIRMADO,
        Order.ESTADO_CANCELADO,
        Order.ESTADO_RECHAZADO,
        Order.ESTADO_SIN_STOCK,
    },
    Order.ESTADO_CONFIRMADO: {
        Order.ESTADO_EN_PREPARACION,
        Order.ESTADO_CANCELADO,
        Order.ESTADO_SIN_STOCK,
    },
    Order.ESTADO_EN_PREPARACION: {
        Order.ESTADO_LISTO,
        Order.ESTADO_CANCELADO,
    },
    Order.ESTADO_LISTO: {
        Order.ESTADO_ENTREGADO,  # retiro en local
        Order.ESTADO_EN_CAMINO,  # delivery
        Order.ESTADO_CANCELADO,
    },
    Order.ESTADO_EN_CAMINO: {
        Order.ESTADO_ENTREGADO,
        Order.ESTADO_CANCELADO,
    },
    Order.ESTADO_ENTREGADO: set(),
    Order.ESTADO_CANCELADO: set(),
    Order.ESTADO_SIN_STOCK: set(),
    Order.ESTADO_RECHAZADO: set(),
}


class InvalidTransition(Exception):
    pass


def can_transition(estado_actual, estado_nuevo):
    return estado_nuevo in TRANSITIONS.get(estado_actual, set())


@transaction.atomic
def transition_order(order, estado_nuevo, actor):
    if not can_transition(order.estado, estado_nuevo):
        raise InvalidTransition(f"No se puede pasar de '{order.estado}' a '{estado_nuevo}'.")

    estado_anterior = order.estado
    order.estado = estado_nuevo
    order.save(update_fields=["estado", "updated_at"])

    OrderEvent.objects.create(
        order=order,
        estado_anterior=estado_anterior,
        estado_nuevo=estado_nuevo,
        actor=actor,
    )
    return order
