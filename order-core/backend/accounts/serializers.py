from rest_framework import serializers

from .models import User


class MeSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    username = serializers.CharField()
    nombre = serializers.CharField()
    rol = serializers.ChoiceField(choices=User.ROL_CHOICES)
    tenant = serializers.IntegerField()


class PingSerializer(serializers.Serializer):
    ok = serializers.BooleanField()
