import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { decrypt, encrypt } from "./aes";

/**
 * Injectable wrapper around the AES helpers. Resolves the 32-byte key lazily so
 * the app can still boot in dev without ACCESS_TOKEN_ENC_KEY set (it only
 * throws the first time encryption is actually needed).
 */
@Injectable()
export class CryptoService {
  private key: Buffer | null = null;

  constructor(private readonly config: ConfigService) {}

  private getKey(): Buffer {
    if (this.key) return this.key;
    const b64 = this.config.get<string>("ACCESS_TOKEN_ENC_KEY");
    if (!b64) {
      throw new Error("ACCESS_TOKEN_ENC_KEY is not configured");
    }
    const key = Buffer.from(b64, "base64");
    if (key.length !== 32) {
      throw new Error(
        "ACCESS_TOKEN_ENC_KEY must decode to 32 bytes (generate: openssl rand -base64 32)",
      );
    }
    this.key = key;
    return key;
  }

  encrypt(plaintext: string): string {
    return encrypt(this.getKey(), plaintext);
  }

  decrypt(payload: string): string {
    return decrypt(this.getKey(), payload);
  }
}
