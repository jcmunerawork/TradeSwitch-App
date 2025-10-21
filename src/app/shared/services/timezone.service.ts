import { Injectable } from '@angular/core';
import * as moment from 'moment-timezone';

@Injectable({
  providedIn: 'root'
})
export class TimezoneService {

  constructor() { }

  /**
   * Obtener la zona horaria del usuario desde el navegador
   */
  getUserTimezone(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (error) {
      console.warn('No se pudo detectar la zona horaria del usuario, usando UTC');
      return 'UTC';
    }
  }

  /**
   * Convertir una fecha local del usuario a UTC
   * MEJORA: Manejo correcto de fechas que ya están en UTC
   * @param localDate Fecha en zona horaria local del usuario
   * @param userTimezone Zona horaria del usuario (opcional, se detecta automáticamente)
   * @returns Fecha en UTC
   */
  convertToUTC(localDate: Date | string, userTimezone?: string): Date {
    const timezone = userTimezone || this.getUserTimezone();
    
    try {
      // Si la fecha ya es un objeto Date, verificar si ya está en UTC
      if (localDate instanceof Date) {
        // Verificar si la fecha ya está en UTC (sin offset de zona horaria)
        const dateString = localDate.toISOString();
        if (dateString.includes('Z') || dateString.includes('+00:00')) {
          // Ya está en UTC, devolver tal como está
          return localDate;
        }
      }
      
      // Si es string, verificar si ya tiene indicador UTC
      if (typeof localDate === 'string') {
        if (localDate.includes('Z') || localDate.includes('+00:00') || localDate.includes('UTC')) {
          // Ya está en UTC, convertir directamente
          return new Date(localDate);
        }
      }
      
      // Crear momento en la zona horaria del usuario
      const momentInUserTz = moment.tz(localDate, timezone);
      
      // Convertir a UTC
      const utcMoment = momentInUserTz.utc();
      
      return utcMoment.toDate();
    } catch (error) {
      console.error('Error convirtiendo fecha a UTC:', error);
      // Fallback: usar la fecha original
      return new Date(localDate);
    }
  }

  /**
   * Convertir una fecha UTC a la zona horaria del usuario
   * @param utcDate Fecha en UTC
   * @param userTimezone Zona horaria del usuario (opcional, se detecta automáticamente)
   * @returns Fecha en zona horaria del usuario
   */
  convertFromUTC(utcDate: Date | string, userTimezone?: string): Date {
    const timezone = userTimezone || this.getUserTimezone();
    
    try {
      // Crear momento UTC
      const utcMoment = moment.utc(utcDate);
      
      // Convertir a la zona horaria del usuario
      const localMoment = utcMoment.tz(timezone);
      
      return localMoment.toDate();
    } catch (error) {
      console.error('Error convirtiendo fecha desde UTC:', error);
      // Fallback: usar la fecha original
      return new Date(utcDate);
    }
  }

  /**
   * Verificar si una fecha está dentro de un rango de horas específico
   * @param date Fecha a verificar
   * @param startTime Hora de inicio (formato HH:mm)
   * @param endTime Hora de fin (formato HH:mm)
   * @param timezone Zona horaria para la comparación
   * @returns true si la fecha está dentro del rango
   */
  isWithinTimeRange(
    date: Date | string, 
    startTime: string, 
    endTime: string, 
    timezone: string
  ): boolean {
    try {
      const momentDate = moment.tz(date, timezone);
      const currentTime = momentDate.format('HH:mm');
      
      // Si el rango cruza medianoche (ej: 22:00 - 06:00)
      if (startTime > endTime) {
        return currentTime >= startTime || currentTime <= endTime;
      } else {
        // Rango normal (ej: 09:00 - 17:00)
        return currentTime >= startTime && currentTime <= endTime;
      }
    } catch (error) {
      console.error('Error verificando rango de tiempo:', error);
      return false;
    }
  }

  /**
   * Obtener la fecha actual en UTC
   * @returns Fecha actual en UTC
   */
  getCurrentUTC(): Date {
    return moment.utc().toDate();
  }

  /**
   * Obtener la fecha actual en la zona horaria del usuario
   * @param userTimezone Zona horaria del usuario (opcional)
   * @returns Fecha actual en zona horaria del usuario
   */
  getCurrentLocal(userTimezone?: string): Date {
    const timezone = userTimezone || this.getUserTimezone();
    return moment.tz(timezone).toDate();
  }

  /**
   * Formatear fecha para mostrar en la zona horaria del usuario
   * @param date Fecha a formatear
   * @param format Formato deseado (por defecto: 'YYYY-MM-DD HH:mm:ss')
   * @param userTimezone Zona horaria del usuario (opcional)
   * @returns Fecha formateada
   */
  formatDate(
    date: Date | string, 
    format: string = 'YYYY-MM-DD HH:mm:ss', 
    userTimezone?: string
  ): string {
    const timezone = userTimezone || this.getUserTimezone();
    
    try {
      return moment.tz(date, timezone).format(format);
    } catch (error) {
      console.error('Error formateando fecha:', error);
      return new Date(date).toString();
    }
  }

  /**
   * Comparar dos fechas considerando zona horaria
   * @param date1 Primera fecha
   * @param date2 Segunda fecha
   * @param timezone Zona horaria para la comparación
   * @returns -1 si date1 < date2, 0 si son iguales, 1 si date1 > date2
   */
  compareDates(
    date1: Date | string, 
    date2: Date | string, 
    timezone?: string
  ): number {
    const tz = timezone || this.getUserTimezone();
    
    try {
      const moment1 = moment.tz(date1, tz);
      const moment2 = moment.tz(date2, tz);
      
      if (moment1.isBefore(moment2)) return -1;
      if (moment1.isAfter(moment2)) return 1;
      return 0;
    } catch (error) {
      console.error('Error comparando fechas:', error);
      return 0;
    }
  }

  /**
   * Verificar si una fecha está en el día de la semana especificado
   * @param date Fecha a verificar
   * @param dayOfWeek Día de la semana (0=domingo, 1=lunes, ..., 6=sábado)
   * @param timezone Zona horaria para la verificación
   * @returns true si la fecha está en el día especificado
   */
  isDayOfWeek(
    date: Date | string, 
    dayOfWeek: number, 
    timezone?: string
  ): boolean {
    const tz = timezone || this.getUserTimezone();
    
    try {
      const momentDate = moment.tz(date, tz);
      return momentDate.day() === dayOfWeek;
    } catch (error) {
      console.error('Error verificando día de la semana:', error);
      return false;
    }
  }

  /**
   * Convertir fecha de trade del servidor a UTC
   * MÉTODO ESPECÍFICO: Para fechas que vienen del servidor y pueden estar en diferentes formatos
   * @param tradeDate Fecha del trade (puede ser timestamp, string, o Date)
   * @returns Fecha en UTC
   */
  convertTradeDateToUTC(tradeDate: any): Date {
    try {
      let utcDate: Date;
      
      // Si es un timestamp numérico (milisegundos)
      if (typeof tradeDate === 'number') {
        utcDate = new Date(tradeDate);
        // Verificar si es válido
        if (isNaN(utcDate.getTime())) {
          throw new Error('Timestamp inválido');
        }
      }
      // Si es un string
      else if (typeof tradeDate === 'string') {
        // Si contiene 'Z' o '+00:00', ya está en UTC
        if (tradeDate.includes('Z') || tradeDate.includes('+00:00')) {
          utcDate = new Date(tradeDate);
        }
        // Si es un timestamp en string
        else {
          const numericValue = parseInt(tradeDate);
          if (!isNaN(numericValue)) {
            utcDate = new Date(numericValue);
          } else {
            utcDate = new Date(tradeDate);
          }
        }
      }
      // Si ya es un Date
      else if (tradeDate instanceof Date) {
        utcDate = tradeDate;
      }
      // Fallback
      else {
        utcDate = new Date(tradeDate);
      }
      
      // FORZAR UTC: Crear una nueva fecha usando UTC para asegurar que esté en UTC
      const utcTimestamp = Date.UTC(
        utcDate.getUTCFullYear(),
        utcDate.getUTCMonth(),
        utcDate.getUTCDate(),
        utcDate.getUTCHours(),
        utcDate.getUTCMinutes(),
        utcDate.getUTCSeconds(),
        utcDate.getUTCMilliseconds()
      );
      
      return new Date(utcTimestamp);
    } catch (error) {
      console.error('Error convirtiendo fecha de trade a UTC:', error);
      return new Date();
    }
  }

  /**
   * Obtener información de debug sobre zona horaria
   * @param date Fecha a analizar
   * @param userTimezone Zona horaria del usuario (opcional)
   * @returns Información de debug
   */
  getTimezoneDebugInfo(date: Date | string, userTimezone?: string): any {
    const timezone = userTimezone || this.getUserTimezone();
    
    try {
      const momentDate = moment.tz(date, timezone);
      const utcDate = moment.utc(date);
      
      return {
        originalDate: date,
        userTimezone: timezone,
        localTime: momentDate.format('YYYY-MM-DD HH:mm:ss'),
        utcTime: utcDate.format('YYYY-MM-DD HH:mm:ss'),
        offset: momentDate.utcOffset(),
        offsetString: momentDate.format('Z'),
        dayOfWeek: momentDate.day(),
        dayName: momentDate.format('dddd')
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        originalDate: date,
        userTimezone: timezone
      };
    }
  }
}
