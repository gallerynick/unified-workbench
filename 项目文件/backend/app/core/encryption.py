"""AES-256-GCM 加密工具模块"""

import json
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def generate_key() -> str:
    """生成 32 字节随机密钥（hex 编码）"""
    return os.urandom(32).hex()


def encrypt_data(data: dict, key: str) -> bytes:
    """
    使用 AES-256-GCM 加密 JSON 数据

    Args:
        data: 要加密的字典数据
        key: 32 字节 hex 编码密钥

    Returns:
        bytes: nonce(12字节) + ciphertext + tag(16字节)
    """
    key_bytes = bytes.fromhex(key)
    nonce = os.urandom(12)
    aesgcm = AESGCM(key_bytes)
    plaintext = json.dumps(data, ensure_ascii=False).encode("utf-8")
    ciphertext = aesgcm.encrypt(nonce, plaintext, None)
    return nonce + ciphertext


def decrypt_data(encrypted: bytes, key: str) -> dict:
    """
    解密 AES-256-GCM 加密的数据

    Args:
        encrypted: nonce + ciphertext + tag
        key: 32 字节 hex 编码密钥

    Returns:
        dict: 解密后的字典数据

    Raises:
        cryptography.exceptions.InvalidTag: 密钥错误或数据损坏
    """
    key_bytes = bytes.fromhex(key)
    nonce = encrypted[:12]
    ciphertext = encrypted[12:]
    aesgcm = AESGCM(key_bytes)
    plaintext = aesgcm.decrypt(nonce, ciphertext, None)
    return json.loads(plaintext.decode("utf-8"))
