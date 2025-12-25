import { AccountState } from '../models/account-state.js';

/**
 * Utilidad para comparar estados de cuentas y detectar cambios
 */
export class StateComparator {
  /**
   * Compara dos estados y retorna true si hay cambios significativos
   * @param {AccountState} oldState - Estado anterior
   * @param {AccountState} newState - Estado nuevo
   * @returns {boolean} - true si hay cambios, false si son iguales
   */
  static hasChanges(oldState, newState) {
    if (!oldState) {
      // Si no hay estado anterior, siempre hay "cambios" (primera vez)
      return true;
    }

    if (!newState) {
      return false;
    }

    // Usar el método equals del modelo
    return !oldState.equals(newState);
  }

  /**
   * Obtiene solo los campos que cambiaron entre dos estados
   * @param {AccountState} oldState - Estado anterior
   * @param {AccountState} newState - Estado nuevo
   * @returns {Object|null} - Objeto con solo los campos que cambiaron, o null si no hay cambios
   */
  static getChangedFields(oldState, newState) {
    if (!this.hasChanges(oldState, newState)) {
      return null;
    }

    if (!oldState) {
      // Primera vez, retornar todo el estado
      return newState.toJSON();
    }

    const changes = {
      accountId: newState.accountId,
      lastUpdated: newState.lastUpdated
    };

    // Verificar si equity cambió
    if (Math.abs(oldState.equity - newState.equity) > 0.0001) {
      changes.equity = newState.equity;
    }

    // Verificar si las posiciones cambiaron
    const positionsChanged = this._positionsChanged(oldState.positions, newState.positions);
    if (positionsChanged) {
      changes.positions = newState.positions;
    }

    return changes;
  }

  /**
   * Compara dos arrays de posiciones para ver si cambiaron
   * @private
   */
  static _positionsChanged(oldPositions, newPositions) {
    if (oldPositions.length !== newPositions.length) {
      return true;
    }

    // Crear un mapa de posiciones por positionId para comparación rápida
    const oldMap = new Map(oldPositions.map(p => [p.positionId, p.pnl]));
    const newMap = new Map(newPositions.map(p => [p.positionId, p.pnl]));

    // Verificar si hay posiciones nuevas o eliminadas
    if (oldMap.size !== newMap.size) {
      return true;
    }

    // Verificar si algún PnL cambió
    for (const [positionId, newPnl] of newMap) {
      const oldPnl = oldMap.get(positionId);
      if (oldPnl === undefined || Math.abs(oldPnl - newPnl) > 0.0001) {
        return true;
      }
    }

    return false;
  }
}

