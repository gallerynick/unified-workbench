"""加密工具测试（4 个用例）"""

import pytest
from cryptography.exceptions import InvalidTag

from app.core.encryption import decrypt_data, encrypt_data, generate_key


def test_encrypt_decrypt_roundtrip():
    """加密后解密应返回原始数据"""
    key = generate_key()
    original = {"username": "admin", "password": "secret123", "api_key": "sk-abc123"}
    encrypted = encrypt_data(original, key)
    decrypted = decrypt_data(encrypted, key)
    assert decrypted == original


def test_encrypt_empty_data():
    """加密空字典应成功"""
    key = generate_key()
    encrypted = encrypt_data({}, key)
    decrypted = decrypt_data(encrypted, key)
    assert decrypted == {}


def test_decrypt_wrong_key_fails():
    """使用错误密钥解密应失败"""
    key1 = generate_key()
    key2 = generate_key()
    encrypted = encrypt_data({"test": "data"}, key1)
    with pytest.raises(InvalidTag):
        decrypt_data(encrypted, key2)


def test_encrypt_produces_different_ciphertext():
    """相同数据多次加密应产生不同密文（随机 nonce）"""
    key = generate_key()
    data = {"test": "data"}
    enc1 = encrypt_data(data, key)
    enc2 = encrypt_data(data, key)
    assert enc1 != enc2  # 不同 nonce
    assert decrypt_data(enc1, key) == decrypt_data(enc2, key)  # 解密结果相同
