import { Component, Input, Output, EventEmitter } from '@angular/core';
import { User } from '../../../overview/models/overview';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Timestamp } from 'firebase/firestore';
import { CountryOption } from '../../../../shared/services/countryService';

@Component({
  selector: 'app-user-modal',
  templateUrl: './user-modal.component.html',
  styleUrls: ['./user-modal.component.scss'],
  imports: [FormsModule, CommonModule],
  standalone: true,
})
export class UserModalComponent {
  @Input() user!: User;
  @Output() close = new EventEmitter<void>();
  @Output() ban = new EventEmitter<{ username: string; reason: string }>();
  @Output() unban = new EventEmitter<string>();
  @Output() sendResetLink = new EventEmitter<string>();
  @Output() logoutEverywhere = new EventEmitter<string>();

  today = new Date();

  usernameToBan = '';
  banReason = '';

  private readonly DEFAULT_DIAL_CODE = '+57';
  private readonly fallbackCountries: { dialCode: string; name: string }[] = [
    // North America
    { dialCode: '+1', name: 'United States/Canada' },
    { dialCode: '+1242', name: 'Bahamas' },
    { dialCode: '+1246', name: 'Barbados' },
    { dialCode: '+1264', name: 'Anguilla' },
    { dialCode: '+1268', name: 'Antigua and Barbuda' },
    { dialCode: '+1284', name: 'British Virgin Islands' },
    { dialCode: '+1340', name: 'US Virgin Islands' },
    { dialCode: '+1345', name: 'Cayman Islands' },
    { dialCode: '+1441', name: 'Bermuda' },
    { dialCode: '+1473', name: 'Grenada' },
    { dialCode: '+1649', name: 'Turks and Caicos Islands' },
    { dialCode: '+1664', name: 'Montserrat' },
    { dialCode: '+1670', name: 'Northern Mariana Islands' },
    { dialCode: '+1671', name: 'Guam' },
    { dialCode: '+1684', name: 'American Samoa' },
    { dialCode: '+1758', name: 'Saint Lucia' },
    { dialCode: '+1767', name: 'Dominica' },
    { dialCode: '+1784', name: 'Saint Vincent and the Grenadines' },
    { dialCode: '+1809', name: 'Dominican Republic' },
    { dialCode: '+1829', name: 'Dominican Republic' },
    { dialCode: '+1849', name: 'Dominican Republic' },
    { dialCode: '+1868', name: 'Trinidad and Tobago' },
    { dialCode: '+1869', name: 'Saint Kitts and Nevis' },
    { dialCode: '+1876', name: 'Jamaica' },
    { dialCode: '+1939', name: 'Puerto Rico' },
    // Central America
    { dialCode: '+502', name: 'Guatemala' },
    { dialCode: '+503', name: 'El Salvador' },
    { dialCode: '+504', name: 'Honduras' },
    { dialCode: '+505', name: 'Nicaragua' },
    { dialCode: '+506', name: 'Costa Rica' },
    { dialCode: '+507', name: 'Panama' },
    { dialCode: '+501', name: 'Belize' },
    // South America
    { dialCode: '+54', name: 'Argentina' },
    { dialCode: '+55', name: 'Brazil' },
    { dialCode: '+56', name: 'Chile' },
    { dialCode: '+57', name: 'Colombia' },
    { dialCode: '+58', name: 'Venezuela' },
    { dialCode: '+51', name: 'Peru' },
    { dialCode: '+593', name: 'Ecuador' },
    { dialCode: '+595', name: 'Paraguay' },
    { dialCode: '+598', name: 'Uruguay' },
    { dialCode: '+591', name: 'Bolivia' },
    { dialCode: '+592', name: 'Guyana' },
    { dialCode: '+597', name: 'Suriname' },
    // Europe
    { dialCode: '+34', name: 'Spain' },
    { dialCode: '+351', name: 'Portugal' },
    { dialCode: '+33', name: 'France' },
    { dialCode: '+49', name: 'Germany' },
    { dialCode: '+39', name: 'Italy' },
    { dialCode: '+44', name: 'United Kingdom' },
    { dialCode: '+31', name: 'Netherlands' },
    { dialCode: '+32', name: 'Belgium' },
    { dialCode: '+352', name: 'Luxembourg' },
    { dialCode: '+41', name: 'Switzerland' },
    { dialCode: '+43', name: 'Austria' },
    { dialCode: '+45', name: 'Denmark' },
    { dialCode: '+46', name: 'Sweden' },
    { dialCode: '+47', name: 'Norway' },
    { dialCode: '+358', name: 'Finland' },
    { dialCode: '+48', name: 'Poland' },
    { dialCode: '+420', name: 'Czech Republic' },
    { dialCode: '+421', name: 'Slovakia' },
    { dialCode: '+36', name: 'Hungary' },
    { dialCode: '+386', name: 'Slovenia' },
    { dialCode: '+385', name: 'Croatia' },
    { dialCode: '+381', name: 'Serbia' },
    { dialCode: '+382', name: 'Montenegro' },
    { dialCode: '+389', name: 'North Macedonia' },
    { dialCode: '+387', name: 'Bosnia and Herzegovina' },
    { dialCode: '+30', name: 'Greece' },
    { dialCode: '+357', name: 'Cyprus' },
    { dialCode: '+353', name: 'Ireland' },
    { dialCode: '+354', name: 'Iceland' },
    { dialCode: '+371', name: 'Latvia' },
    { dialCode: '+370', name: 'Lithuania' },
    { dialCode: '+372', name: 'Estonia' },
    { dialCode: '+375', name: 'Belarus' },
    { dialCode: '+380', name: 'Ukraine' },
    { dialCode: '+373', name: 'Moldova' },
    { dialCode: '+7', name: 'Russia/Kazakhstan' },
    { dialCode: '+376', name: 'Andorra' },
    { dialCode: '+377', name: 'Monaco' },
    { dialCode: '+378', name: 'San Marino' },
    { dialCode: '+379', name: 'Vatican City' },
    { dialCode: '+423', name: 'Liechtenstein' },
    { dialCode: '+356', name: 'Malta' },
    { dialCode: '+298', name: 'Faroe Islands' },
    { dialCode: '+47', name: 'Svalbard and Jan Mayen' },
    // Africa
    { dialCode: '+20', name: 'Egypt' },
    { dialCode: '+212', name: 'Morocco' },
    { dialCode: '+213', name: 'Algeria' },
    { dialCode: '+216', name: 'Tunisia' },
    { dialCode: '+218', name: 'Libya' },
    { dialCode: '+221', name: 'Senegal' },
    { dialCode: '+225', name: 'Ivory Coast' },
    { dialCode: '+229', name: 'Benin' },
    { dialCode: '+233', name: 'Ghana' },
    { dialCode: '+234', name: 'Nigeria' },
    { dialCode: '+237', name: 'Cameroon' },
    { dialCode: '+240', name: 'Equatorial Guinea' },
    { dialCode: '+241', name: 'Gabon' },
    { dialCode: '+242', name: 'Republic of the Congo' },
    { dialCode: '+243', name: 'Democratic Republic of the Congo' },
    { dialCode: '+244', name: 'Angola' },
    { dialCode: '+248', name: 'Seychelles' },
    { dialCode: '+249', name: 'Sudan' },
    { dialCode: '+250', name: 'Rwanda' },
    { dialCode: '+251', name: 'Ethiopia' },
    { dialCode: '+252', name: 'Somalia' },
    { dialCode: '+253', name: 'Djibouti' },
    { dialCode: '+254', name: 'Kenya' },
    { dialCode: '+255', name: 'Tanzania' },
    { dialCode: '+256', name: 'Uganda' },
    { dialCode: '+257', name: 'Burundi' },
    { dialCode: '+258', name: 'Mozambique' },
    { dialCode: '+260', name: 'Zambia' },
    { dialCode: '+261', name: 'Madagascar' },
    { dialCode: '+263', name: 'Zimbabwe' },
    { dialCode: '+264', name: 'Namibia' },
    { dialCode: '+265', name: 'Malawi' },
    { dialCode: '+266', name: 'Lesotho' },
    { dialCode: '+267', name: 'Botswana' },
    { dialCode: '+268', name: 'Eswatini' },
    { dialCode: '+269', name: 'Comoros' },
    { dialCode: '+27', name: 'South Africa' },
    { dialCode: '+290', name: 'Saint Helena' },
    { dialCode: '+291', name: 'Eritrea' },
    { dialCode: '+220', name: 'Gambia' },
    { dialCode: '+223', name: 'Mali' },
    { dialCode: '+226', name: 'Burkina Faso' },
    { dialCode: '+ Niger', name: 'Niger' },
    { dialCode: '+228', name: 'Togo' },
    { dialCode: '+232', name: 'Sierra Leone' },
    { dialCode: '+231', name: 'Liberia' },
    { dialCode: '+235', name: 'Chad' },
    { dialCode: '+236', name: 'Central African Republic' },
    { dialCode: '+237', name: 'Cameroon' },
    { dialCode: '+238', name: 'Cape Verde' },
    { dialCode: '+239', name: 'São Tomé and Príncipe' },
    { dialCode: '+248', name: 'Seychelles' },
    { dialCode: '+ Mauritania', name: 'Mauritania' },
    { dialCode: '+222', name: 'Mauritania' },
    { dialCode: '+230', name: 'Mauritius' },
    // Middle East / Asia
    { dialCode: '+90', name: 'Turkey' },
    { dialCode: '+30', name: 'Greece' },
    { dialCode: '+972', name: 'Israel' },
    { dialCode: '+970', name: 'Palestine' },
    { dialCode: '+961', name: 'Lebanon' },
    { dialCode: '+962', name: 'Jordan' },
    { dialCode: '+963', name: 'Syria' },
    { dialCode: '+964', name: 'Iraq' },
    { dialCode: '+965', name: 'Kuwait' },
    { dialCode: '+966', name: 'Saudi Arabia' },
    { dialCode: '+971', name: 'United Arab Emirates' },
    { dialCode: '+973', name: 'Bahrain' },
    { dialCode: '+974', name: 'Qatar' },
    { dialCode: '+968', name: 'Oman' },
    { dialCode: '+98', name: 'Iran' },
    { dialCode: '+92', name: 'Pakistan' },
    { dialCode: '+93', name: 'Afghanistan' },
    { dialCode: '+94', name: 'Sri Lanka' },
    { dialCode: '+95', name: 'Myanmar' },
    { dialCode: '+855', name: 'Cambodia' },
    { dialCode: '+856', name: 'Laos' },
    { dialCode: '+66', name: 'Thailand' },
    { dialCode: '+84', name: 'Vietnam' },
    { dialCode: '+60', name: 'Malaysia' },
    { dialCode: '+62', name: 'Indonesia' },
    { dialCode: '+63', name: 'Philippines' },
    { dialCode: '+65', name: 'Singapore' },
    { dialCode: '+81', name: 'Japan' },
    { dialCode: '+82', name: 'South Korea' },
    { dialCode: '+86', name: 'China' },
    { dialCode: '+852', name: 'Hong Kong' },
    { dialCode: '+853', name: 'Macau' },
    { dialCode: '+886', name: 'Taiwan' },
    { dialCode: '+91', name: 'India' },
    { dialCode: '+880', name: 'Bangladesh' },
    { dialCode: '+977', name: 'Nepal' },
    { dialCode: '+975', name: 'Bhutan' },
    { dialCode: '+960', name: 'Maldives' },
    { dialCode: '+7', name: 'Kazakhstan' },
    { dialCode: '+998', name: 'Uzbekistan' },
    { dialCode: '+996', name: 'Kyrgyzstan' },
    { dialCode: '+992', name: 'Tajikistan' },
    { dialCode: '+993', name: 'Turkmenistan' },
    { dialCode: '+373', name: 'Moldova' },
    // Oceania
    { dialCode: '+61', name: 'Australia' },
    { dialCode: '+64', name: 'New Zealand' },
    { dialCode: '+679', name: 'Fiji' },
    { dialCode: '+682', name: 'Cook Islands' },
    { dialCode: '+683', name: 'Niue' },
    { dialCode: '+685', name: 'Samoa' },
    { dialCode: '+676', name: 'Tonga' },
    { dialCode: '+678', name: 'Vanuatu' },
    { dialCode: '+675', name: 'Papua New Guinea' },
    { dialCode: '+674', name: 'Nauru' },
    { dialCode: '+686', name: 'Kiribati' },
    { dialCode: '+688', name: 'Tuvalu' },
    { dialCode: '+690', name: 'Tokelau' },
    { dialCode: '+689', name: 'French Polynesia' },
    { dialCode: '+687', name: 'New Caledonia' },
    { dialCode: '+681', name: 'Wallis and Futuna' },
  ];


  private normalizePhone(input?: string): string | null {
    if (!input) return null;
    const raw = input
      .toString()
      .trim()
      .replace(/[\s\-().]/g, '');
    if (!raw) return null;
    if (raw.startsWith('+')) return raw;
    if (raw.startsWith('00')) return `+${raw.slice(2)}`;
    // Sin prefijo internacional, asumimos código por defecto para detección
    return `${this.DEFAULT_DIAL_CODE}${raw}`;
  }

  private resolveCountryFromPhone(phone?: string): string {
    const normalized = this.normalizePhone(phone);
    if (!normalized) return 'Unknown';
    const match = [...this.fallbackCountries]
      .sort((a, b) => b.dialCode.length - a.dialCode.length)
      .find((c) => normalized.startsWith(c.dialCode));
    return match ? match.name : 'Unknown';
  }

  get countryFromPhone(): string {
    return this.resolveCountryFromPhone(this.user?.phoneNumber as unknown as string);
  }

  get aov(): string {
    return this.user.total_spend && this.user.number_trades
      ? (this.user.total_spend / this.user.number_trades).toFixed(2)
      : '0.00';
  }

  onlyNameInitials(user: User) {
    return user.firstName.charAt(0) + user.lastName.charAt(0);
  }
  getUserDate(date: number): Date {
    return new Date(date);
  }
}
