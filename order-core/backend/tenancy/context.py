from contextlib import contextmanager
from contextvars import ContextVar

_current_tenant_id = ContextVar("current_tenant_id", default=None)


def get_current_tenant_id():
    return _current_tenant_id.get()


def set_current_tenant_id(tenant_id):
    _current_tenant_id.set(tenant_id)


def clear_current_tenant_id():
    _current_tenant_id.set(None)


@contextmanager
def tenant_context(tenant_id):
    token = _current_tenant_id.set(tenant_id)
    try:
        yield
    finally:
        _current_tenant_id.reset(token)
