/**
 * Modelo para el estado de una cuenta de trading
 */
export class AccountState {
  /**
   * @param {string} accountId - ID de la cuenta (solo número, sin prefijo L#)
   * @param {number} equity - Equity actual de la cuenta
   * @param {Array} positions - Array de posiciones abiertas
   */
  constructor(accountId, equity, positions = []) {
    this.accountId = accountId;
    this.equity = equity;
    this.positions = positions;
    this.lastUpdated = Date.now();
  }

  /**
   * Crea un AccountState desde un mensaje AccountStatus de TradeLocker
   * @param {Object} accountStatus - Mensaje AccountStatus completo
   * @returns {AccountState}
   */
  static fromAccountStatus(accountStatus) {
    // Extraer solo el número del accountId (ej: "L#821923" -> "821923")
    const accountId = accountStatus.accountId?.replace(/^[A-Z]#/, '') || '';
    
    // Convertir equity a número
    const equity = parseFloat(accountStatus.equity) || 0;
    
    // Extraer posiciones del array positionPnLs
    const positions = (accountStatus.positionPnLs || []).map(pnl => ({
      positionId: pnl.positionId,
      pnl: parseFloat(pnl.pnl) || 0
    }));

    return new AccountState(accountId, equity, positions);
  }

  /**
   * Convierte el estado a un objeto plano para enviar al frontend
   * @returns {Object}
   */
  toJSON() {
    return {
      accountId: this.accountId,
      equity: this.equity,
      positions: this.positions,
      lastUpdated: this.lastUpdated
    };
  }

  /**
   * Compara dos estados para ver si son iguales
   * @param {AccountState} other - Otro estado para comparar
   * @returns {boolean}
   */
  equals(other) {
    if (!other || !(other instanceof AccountState)) {
      return false;
    }

    // Comparar accountId
    if (this.accountId !== other.accountId) {
      return false;
    }

    // Comparar equity (con tolerancia para números flotantes)
    if (Math.abs(this.equity - other.equity) > 0.0001) {
      return false;
    }

    // Comparar posiciones
    if (this.positions.length !== other.positions.length) {
      return false;
    }

    // Comparar cada posición
    for (let i = 0; i < this.positions.length; i++) {
      const pos1 = this.positions[i];
      const pos2 = other.positions[i];
      
      if (pos1.positionId !== pos2.positionId ||
          Math.abs(pos1.pnl - pos2.pnl) > 0.0001) {
        return false;
      }
    }

    return true;
  }
}

