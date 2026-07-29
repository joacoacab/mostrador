from rest_framework import serializers

from .models import PairingCode


class PairingCodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = PairingCode
        fields = ["code", "expires_at"]
        read_only_fields = fields


class PairingClaimSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=6)


class PairingClaimResultSerializer(serializers.Serializer):
    device_token = serializers.CharField()
    tenant_nombre = serializers.CharField()
