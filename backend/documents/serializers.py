from rest_framework import serializers
from .models import Document


class DocumentListSerializer(serializers.ModelSerializer):
    file_url         = serializers.SerializerMethodField()
    uploaded_by_name = serializers.SerializerMethodField()

    def get_file_url(self, obj):
        return obj.file_url

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return obj.uploaded_by.get_full_name() or obj.uploaded_by.email
        return None

    class Meta:
        model  = Document
        fields = (
            'id', 'original_filename', 'file_url',
            'file_type', 'file_size_bytes', 'document_type',
            'dms_file_number',
            'linked_plot', 'linked_patta',
            'status', 'uploaded_by', 'uploaded_by_name', 'uploaded_at',
        )


class DocumentDetailSerializer(serializers.ModelSerializer):
    file_url          = serializers.SerializerMethodField()
    uploaded_by_name  = serializers.SerializerMethodField()
    verified_by_name  = serializers.SerializerMethodField()

    def get_file_url(self, obj):
        return obj.file_url

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return obj.uploaded_by.get_full_name() or obj.uploaded_by.email
        return None

    def get_verified_by_name(self, obj):
        if obj.verified_by:
            return obj.verified_by.get_full_name() or obj.verified_by.email
        return None

    class Meta:
        model  = Document
        fields = (
            'id', 'original_filename', 'file_url',
            'file_type', 'mime_type', 'file_size_bytes',
            'document_type', 'dms_file_number',
            'linked_plot', 'linked_patta',
            'status',
            'uploaded_by', 'uploaded_by_name', 'uploaded_at',
            'verified_by', 'verified_by_name', 'verified_at',
            'created_at', 'updated_at',
        )
        read_only_fields = ('created_at', 'updated_at', 'uploaded_at',
                            'uploaded_by', 'verified_by', 'verified_at')


class DocumentUploadSerializer(serializers.ModelSerializer):
    """
    Used for multipart POST /api/documents/.
    `file` is required; `document_type`, `linked_plot`, `linked_patta`,
    `dms_file_number` are optional.
    """

    class Meta:
        model  = Document
        fields = (
            'file', 'document_type', 'dms_file_number',
            'linked_plot', 'linked_patta',
        )

    def validate_file(self, value):
        allowed_types = {'application/pdf', 'image/jpeg', 'image/png'}
        if value.content_type not in allowed_types:
            raise serializers.ValidationError(
                f'Unsupported file type: {value.content_type}. '
                'Allowed: PDF, JPEG, PNG.'
            )
        max_size = 20 * 1024 * 1024  # 20 MB
        if value.size > max_size:
            raise serializers.ValidationError(
                f'File too large ({value.size // 1024 // 1024} MB). Max 20 MB.'
            )
        return value

    def create(self, validated_data):
        uploaded_file = validated_data['file']
        mime          = uploaded_file.content_type
        ftype_map     = {
            'application/pdf': 'pdf',
            'image/jpeg':      'jpg',
            'image/png':       'png',
        }
        validated_data['original_filename'] = uploaded_file.name
        validated_data['file_size_bytes']   = uploaded_file.size
        validated_data['mime_type']         = mime
        validated_data['file_type']         = ftype_map.get(mime, '')
        return super().create(validated_data)
