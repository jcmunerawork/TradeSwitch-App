import { AccountState } from '../models/account-state.js';
import { StateComparator } from '../utils/state-comparator.js';

/**
 * Servicio para procesar y filtrar mensajes del stream de TradeLocker
 * Solo reenvía mensajes cuando hay cambios significativos
 * Implementa throttling para limitar a máximo 1 mensaje por minuto
 */
export class StreamProcessor {
  constructor() {
    // Almacenar el estado de cada cuenta por cliente
    // Estructura: Map<clientSocketId, Map<accountId, AccountState>>
    this.accountStates = new Map();
    
    // Throttling: almacenar última vez que se envió un mensaje por cuenta
    // Estructura: Map<clientSocketId, Map<accountId, lastSentTimestamp>>
    this.lastSentTimestamps = new Map();
    
    // Intervalo mínimo entre mensajes (1 minuto = 60000ms)
    this.MIN_INTERVAL_MS = 60000;
  }

  /**
   * Procesa un mensaje del stream y retorna el mensaje filtrado si hay cambios
   * @param {string} clientSocketId - ID del socket del cliente
   * @param {Object} message - Mensaje recibido del stream
   * @returns {Object|null} - Mensaje procesado o null si no hay cambios o está en throttling
   */
  processMessage(clientSocketId, message) {
    if (!message || !message.type) {
      return null;
    }

    // Para mensajes que NO son AccountStatus, reenviar siempre (son eventos importantes)
    // Estos incluyen: Position, ClosePosition, OpenOrder, Property, etc.
    if (message.type !== 'AccountStatus') {
      return message;
    }

    // Solo procesar mensajes de tipo AccountStatus con throttling
    try {
      // Crear el nuevo estado desde el mensaje
      const newState = AccountState.fromAccountStatus(message);
      const accountId = newState.accountId;

      // Verificar throttling: solo enviar si ha pasado el intervalo mínimo
      if (!this.canSendMessage(clientSocketId, accountId)) {
        // Actualizar el estado aunque no se envíe (para mantener estado actualizado)
        if (!this.accountStates.has(clientSocketId)) {
          this.accountStates.set(clientSocketId, new Map());
        }
        this.accountStates.get(clientSocketId).set(accountId, newState);
        return null; // Throttling activo, no enviar
      }

      // Obtener el estado anterior para esta cuenta y cliente
      const clientStates = this.accountStates.get(clientSocketId) || new Map();
      const oldState = clientStates.get(accountId);

      // Verificar si hay cambios
      if (!StateComparator.hasChanges(oldState, newState)) {
        // No hay cambios, no reenviar
        return null;
      }

      // Hay cambios y no está en throttling, actualizar el estado almacenado
      if (!this.accountStates.has(clientSocketId)) {
        this.accountStates.set(clientSocketId, new Map());
      }
      this.accountStates.get(clientSocketId).set(accountId, newState);

      // Marcar que se envió este mensaje
      this.markMessageSent(clientSocketId, accountId);

      // Retornar solo los datos necesarios
      return {
        type: 'AccountStatus',
        accountId: newState.accountId,
        equity: newState.equity,
        positions: newState.positions,
        timestamp: newState.lastUpdated
      };
    } catch (error) {
      console.error('❌ [STREAM-PROCESSOR] Error procesando mensaje:', error);
      console.error('   Mensaje original:', message);
      // En caso de error, reenviar el mensaje original para no perder datos
      return message;
    }
  }

  /**
   * Verifica si se puede enviar un mensaje según el throttling
   * @param {string} clientSocketId - ID del socket del cliente
   * @param {string} accountId - ID de la cuenta
   * @returns {boolean} - true si se puede enviar, false si está en throttling
   */
  canSendMessage(clientSocketId, accountId) {
    if (!this.lastSentTimestamps.has(clientSocketId)) {
      this.lastSentTimestamps.set(clientSocketId, new Map());
      return true; // Primera vez, permitir envío
    }

    const clientTimestamps = this.lastSentTimestamps.get(clientSocketId);
    const lastSent = clientTimestamps.get(accountId);

    if (!lastSent) {
      return true; // Primera vez para esta cuenta, permitir envío
    }

    const now = Date.now();
    const timeSinceLastSent = now - lastSent;

    // Solo permitir si ha pasado el intervalo mínimo
    return timeSinceLastSent >= this.MIN_INTERVAL_MS;
  }

  /**
   * Marca que se envió un mensaje para una cuenta
   * @param {string} clientSocketId - ID del socket del cliente
   * @param {string} accountId - ID de la cuenta
   */
  markMessageSent(clientSocketId, accountId) {
    if (!this.lastSentTimestamps.has(clientSocketId)) {
      this.lastSentTimestamps.set(clientSocketId, new Map());
    }
    this.lastSentTimestamps.get(clientSocketId).set(accountId, Date.now());
  }

  /**
   * Limpia el estado de un cliente cuando se desconecta
   * @param {string} clientSocketId - ID del socket del cliente
   */
  clearClientState(clientSocketId) {
    if (this.accountStates.has(clientSocketId)) {
      this.accountStates.delete(clientSocketId);
    }
    if (this.lastSentTimestamps.has(clientSocketId)) {
      this.lastSentTimestamps.delete(clientSocketId);
    }
    console.log(`🧹 [STREAM-PROCESSOR] Estado limpiado para cliente: ${clientSocketId}`);
  }

  /**
   * Obtiene el estado actual de una cuenta para un cliente
   * @param {string} clientSocketId - ID del socket del cliente
   * @param {string} accountId - ID de la cuenta
   * @returns {AccountState|null}
   */
  getAccountState(clientSocketId, accountId) {
    const clientStates = this.accountStates.get(clientSocketId);
    if (!clientStates) {
      return null;
    }
    return clientStates.get(accountId) || null;
  }

  /**
   * Obtiene todas las cuentas de un cliente
   * @param {string} clientSocketId - ID del socket del cliente
   * @returns {Array<AccountState>}
   */
  getAllAccountStates(clientSocketId) {
    const clientStates = this.accountStates.get(clientSocketId);
    if (!clientStates) {
      return [];
    }
    return Array.from(clientStates.values());
  }
}

