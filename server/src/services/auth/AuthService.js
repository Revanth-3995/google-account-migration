import { AccountRepository } from '../../repositories/AccountRepository.js';

export class AuthService {
  static async saveToken(ownerSessionId, accountData) {
    return await AccountRepository.save(ownerSessionId, accountData);
  }

  static async getTokens(ownerSessionId) {
    return await AccountRepository.getAll(ownerSessionId);
  }

  static async getSourceToken(ownerSessionId) {
    const acc = await AccountRepository.getByRole(ownerSessionId, 'source');
    if (!acc || !acc.token_data) return null;
    return JSON.parse(acc.token_data).access_token;
  }

  static async getDestToken(ownerSessionId) {
    const acc = await AccountRepository.getByRole(ownerSessionId, 'destination');
    if (!acc || !acc.token_data) return null;
    return JSON.parse(acc.token_data).access_token;
  }
}
