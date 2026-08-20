import { AccountRepository } from '../../repositories/AccountRepository.js';

export class AuthService {
  static async saveToken(accountData) {
    return await AccountRepository.save(accountData);
  }

  static async getTokens() {
    return await AccountRepository.getAll();
  }

  static async getSourceToken() {
    const acc = await AccountRepository.get('source');
    if (!acc || !acc.token_data) return null;
    return JSON.parse(acc.token_data).access_token;
  }

  static async getDestToken() {
    const acc = await AccountRepository.get('destination');
    if (!acc || !acc.token_data) return null;
    return JSON.parse(acc.token_data).access_token;
  }
}
