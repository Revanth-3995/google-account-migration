import { AccountRepository } from '../../repositories/AccountRepository.js';

export class AuthService {
  static saveToken(accountData) {
    return AccountRepository.save(accountData);
  }

  static getTokens() {
    return AccountRepository.getAll();
  }

  static getSourceToken() {
    const acc = AccountRepository.get('source');
    if (!acc || !acc.token_data) return null;
    return JSON.parse(acc.token_data).access_token;
  }

  static getDestToken() {
    const acc = AccountRepository.get('destination');
    if (!acc || !acc.token_data) return null;
    return JSON.parse(acc.token_data).access_token;
  }
}
