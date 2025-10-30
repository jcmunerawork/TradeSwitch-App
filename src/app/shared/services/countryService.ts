
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, shareReplay, tap } from 'rxjs';

export interface Country {
  name: {
    common: string;
    official: string;
  };
  flags: {
    png: string;
    svg: string;
    alt: string;
  };
  idd: {
    root: string;
    suffixes: string[];
  };
}

export interface CountryOption {
  code: string;
  name: string;
  flag: string;
  dialCode: string;
}

@Injectable({
  providedIn: 'root'
})
export class CountryService {
  private apiUrl = 'https://restcountries.com/v3.1/all?fields=idd,flags,name';
  private cachedCountries: CountryOption[] | null = null;
  private inFlight$?: Observable<CountryOption[]>;

  constructor(private http: HttpClient) {}

  getCountries(): Observable<CountryOption[]> {
    if (this.cachedCountries) {
      return new Observable<CountryOption[]>((subscriber) => {
        subscriber.next(this.cachedCountries as CountryOption[]);
        subscriber.complete();
      });
    }

    if (this.inFlight$) {
      return this.inFlight$;
    }

    this.inFlight$ = this.http.get<Country[]>(this.apiUrl).pipe(
      map(countries => 
        countries
          .filter(country => country.idd && country.idd.root && country.idd.suffixes)
          .map(country => ({
            code: this.extractCountryCode(country.name.common),
            name: country.name.common,
            flag: country.flags.svg,
            dialCode: this.formatDialCode(country.idd.root, country.idd.suffixes[0])
          }))
          .sort((a, b) => a.name.localeCompare(b.name))
      ),
      tap(list => {
        this.cachedCountries = list;
      }),
      shareReplay(1)
    );

    return this.inFlight$;
  }

  private extractCountryCode(countryName: string): string {
    // Mapeo de nombres de países a códigos ISO para casos especiales
    const countryCodeMap: { [key: string]: string } = {
      'United States': 'US',
      'United Kingdom': 'GB',
      'South Korea': 'KR',
      'North Korea': 'KP',
      'United Arab Emirates': 'AE',
      'Czech Republic': 'CZ',
      'Dominican Republic': 'DO',
      'Central African Republic': 'CF',
      'Republic of the Congo': 'CG',
      'Democratic Republic of the Congo': 'CD',
      'South Africa': 'ZA',
      'New Zealand': 'NZ',
      'Papua New Guinea': 'PG',
      'Saudi Arabia': 'SA',
      'Costa Rica': 'CR',
      'El Salvador': 'SV',
      'Puerto Rico': 'PR',
      'Trinidad and Tobago': 'TT',
      'Saint Vincent and the Grenadines': 'VC',
      'Saint Kitts and Nevis': 'KN',
      'Antigua and Barbuda': 'AG',
      'Saint Lucia': 'LC',
      'Dominica': 'DM',
      'Grenada': 'GD',
      'Barbados': 'BB',
      'Bahamas': 'BS',
      'Bermuda': 'BM',
      'Cayman Islands': 'KY',
      'British Virgin Islands': 'VG',
      'US Virgin Islands': 'VI',
      'Turks and Caicos Islands': 'TC',
      'Anguilla': 'AI',
      'Montserrat': 'MS',
      'Sint Maarten': 'SX',
      'Aruba': 'AW',
      'Curaçao': 'CW',
      'Bonaire': 'BQ',
      'Saba': 'BQ',
      'Sint Eustatius': 'BQ',
      'Falkland Islands': 'FK',
      'South Georgia and the South Sandwich Islands': 'GS',
      'British Indian Ocean Territory': 'IO',
      'Pitcairn Islands': 'PN',
      'Saint Helena': 'SH',
      'Ascension Island': 'AC',
      'Tristan da Cunha': 'TA',
      'Norfolk Island': 'NF',
      'Christmas Island': 'CX',
      'Cocos Islands': 'CC',
      'Heard Island and McDonald Islands': 'HM',
      'Bouvet Island': 'BV',
      'Svalbard and Jan Mayen': 'SJ',
      'Åland Islands': 'AX',
      'Faroe Islands': 'FO',
      'Greenland': 'GL',
      'French Guiana': 'GF',
      'Guadeloupe': 'GP',
      'Martinique': 'MQ',
      'Mayotte': 'YT',
      'Réunion': 'RE',
      'Saint Barthélemy': 'BL',
      'Saint Martin': 'MF',
      'Saint Pierre and Miquelon': 'PM',
      'Wallis and Futuna': 'WF',
      'French Polynesia': 'PF',
      'New Caledonia': 'NC',
      'Cook Islands': 'CK',
      'Niue': 'NU',
      'Tokelau': 'TK',
      'American Samoa': 'AS',
      'Guam': 'GU',
      'Northern Mariana Islands': 'MP',
      'Marshall Islands': 'MH',
      'Micronesia': 'FM',
      'Palau': 'PW',
      'Solomon Islands': 'SB',
      'Vanuatu': 'VU',
      'Fiji': 'FJ',
      'Tonga': 'TO',
      'Kiribati': 'KI',
      'Nauru': 'NR',
      'Tuvalu': 'TV',
      'Samoa': 'WS',
      'Timor-Leste': 'TL',
      'Brunei': 'BN',
      'Maldives': 'MV',
      'Sri Lanka': 'LK',
      'Bangladesh': 'BD',
      'Bhutan': 'BT',
      'Nepal': 'NP',
      'Myanmar': 'MM',
      'Thailand': 'TH',
      'Cambodia': 'KH',
      'Vietnam': 'VN',
      'Malaysia': 'MY',
      'Indonesia': 'ID',
      'Philippines': 'PH',
      'Taiwan': 'TW',
      'Hong Kong': 'HK',
      'Macau': 'MO',
      'Mongolia': 'MN',
      'Kazakhstan': 'KZ',
      'Uzbekistan': 'UZ',
      'Turkmenistan': 'TM',
      'Tajikistan': 'TJ',
      'Kyrgyzstan': 'KG',
      'Afghanistan': 'AF',
      'Pakistan': 'PK',
      'India': 'IN',
      'China': 'CN',
      'Japan': 'JP',
      'Russia': 'RU',
      'Belarus': 'BY',
      'Ukraine': 'UA',
      'Moldova': 'MD',
      'Romania': 'RO',
      'Bulgaria': 'BG',
      'Greece': 'GR',
      'Turkey': 'TR',
      'Cyprus': 'CY',
      'Lebanon': 'LB',
      'Syria': 'SY',
      'Iraq': 'IQ',
      'Iran': 'IR',
      'Israel': 'IL',
      'Palestine': 'PS',
      'Jordan': 'JO',
      'Kuwait': 'KW',
      'Qatar': 'QA',
      'Bahrain': 'BH',
      'Oman': 'OM',
      'Yemen': 'YE',
      'Egypt': 'EG',
      'Libya': 'LY',
      'Tunisia': 'TN',
      'Algeria': 'DZ',
      'Morocco': 'MA',
      'Western Sahara': 'EH',
      'Mauritania': 'MR',
      'Mali': 'ML',
      'Burkina Faso': 'BF',
      'Niger': 'NE',
      'Chad': 'TD',
      'Sudan': 'SD',
      'South Sudan': 'SS',
      'Ethiopia': 'ET',
      'Eritrea': 'ER',
      'Djibouti': 'DJ',
      'Somalia': 'SO',
      'Kenya': 'KE',
      'Uganda': 'UG',
      'Tanzania': 'TZ',
      'Rwanda': 'RW',
      'Burundi': 'BI',
      'Cameroon': 'CM',
      'Nigeria': 'NG',
      'Benin': 'BJ',
      'Togo': 'TG',
      'Ghana': 'GH',
      'Ivory Coast': 'CI',
      'Liberia': 'LR',
      'Sierra Leone': 'SL',
      'Guinea': 'GN',
      'Guinea-Bissau': 'GW',
      'Senegal': 'SN',
      'Gambia': 'GM',
      'Cape Verde': 'CV',
      'São Tomé and Príncipe': 'ST',
      'Equatorial Guinea': 'GQ',
      'Gabon': 'GA',
      'Angola': 'AO',
      'Zambia': 'ZM',
      'Zimbabwe': 'ZW',
      'Botswana': 'BW',
      'Namibia': 'NA',
      'Lesotho': 'LS',
      'Eswatini': 'SZ',
      'Madagascar': 'MG',
      'Mauritius': 'MU',
      'Seychelles': 'SC',
      'Comoros': 'KM',
      'Malawi': 'MW',
      'Mozambique': 'MZ',
      'Iceland': 'IS',
      'Ireland': 'IE',
      'Norway': 'NO',
      'Sweden': 'SE',
      'Finland': 'FI',
      'Denmark': 'DK',
      'Estonia': 'EE',
      'Latvia': 'LV',
      'Lithuania': 'LT',
      'Poland': 'PL',
      'Germany': 'DE',
      'Netherlands': 'NL',
      'Belgium': 'BE',
      'Luxembourg': 'LU',
      'France': 'FR',
      'Monaco': 'MC',
      'Liechtenstein': 'LI',
      'Switzerland': 'CH',
      'Austria': 'AT',
      'Slovakia': 'SK',
      'Hungary': 'HU',
      'Slovenia': 'SI',
      'Croatia': 'HR',
      'Bosnia and Herzegovina': 'BA',
      'Serbia': 'RS',
      'Montenegro': 'ME',
      'North Macedonia': 'MK',
      'Albania': 'AL',
      'Kosovo': 'XK',
      'Italy': 'IT',
      'San Marino': 'SM',
      'Vatican City': 'VA',
      'Malta': 'MT',
      'Spain': 'ES',
      'Portugal': 'PT',
      'Andorra': 'AD',
      'Canada': 'CA',
      'Mexico': 'MX',
      'Guatemala': 'GT',
      'Belize': 'BZ',
      'Honduras': 'HN',
      'Panama': 'PA',
      'Cuba': 'CU',
      'Jamaica': 'JM',
      'Haiti': 'HT',
      'Colombia': 'CO',
      'Venezuela': 'VE',
      'Guyana': 'GY',
      'Suriname': 'SR',
      'Brazil': 'BR',
      'Ecuador': 'EC',
      'Peru': 'PE',
      'Bolivia': 'BO',
      'Paraguay': 'PY',
      'Uruguay': 'UY',
      'Argentina': 'AR',
      'Chile': 'CL'
    };

    return countryCodeMap[countryName] || countryName.substring(0, 2).toUpperCase();
  }

  private formatDialCode(root: string, suffix: string): string {
    return root + suffix;
  }
}