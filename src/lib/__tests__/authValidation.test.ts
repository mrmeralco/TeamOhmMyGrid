import {
  validateFullName,
  validateUsername,
  validateEmail,
  cleanCAN,
  formatCANDisplay,
  validateCAN,
  evaluatePassword,
  validatePassword,
  validateConfirmPassword,
  detectIdentifierType,
  validateLoginIdentifier,
} from '../../utils/validation';

describe('1. Full Name Validation Rules', () => {
  it('accepts valid alphabetic full names with spaces', () => {
    expect(validateFullName('Nena Villanueva').isValid).toBe(true);
    expect(validateFullName('Jaeda Marthena Iral').isValid).toBe(true);
    expect(validateFullName('Carl Benedict Enriquez').isValid).toBe(true);
    expect(validateFullName('Al').isValid).toBe(true);
  });

  it('rejects names shorter than 2 characters', () => {
    expect(validateFullName('N').isValid).toBe(false);
    expect(validateFullName('').isValid).toBe(false);
    expect(validateFullName('   ').isValid).toBe(false);
  });

  it('rejects names containing numbers or special symbols', () => {
    expect(validateFullName('Nena123').isValid).toBe(false);
    expect(validateFullName('Nena Villanueva!').isValid).toBe(false);
    expect(validateFullName('user_name').isValid).toBe(false);
  });
});

describe('2. Username Validation Rules', () => {
  it('accepts alphanumeric usernames between 4 and 20 characters', () => {
    expect(validateUsername('nenav2026').isValid).toBe(true);
    expect(validateUsername('carl12').isValid).toBe(true);
    expect(validateUsername('admin99').isValid).toBe(true);
    expect(validateUsername('user1234567890123456').isValid).toBe(true);
  });

  it('rejects usernames shorter than 4 characters', () => {
    expect(validateUsername('abc').isValid).toBe(false);
    expect(validateUsername('a').isValid).toBe(false);
  });

  it('rejects usernames longer than 20 characters', () => {
    expect(validateUsername('thisusernamehasmorethan20characters').isValid).toBe(false);
  });

  it('rejects usernames containing spaces', () => {
    expect(validateUsername('nena v').isValid).toBe(false);
    expect(validateUsername('user name').isValid).toBe(false);
  });

  it('rejects usernames containing special characters', () => {
    expect(validateUsername('nena_v').isValid).toBe(false);
    expect(validateUsername('user@2026').isValid).toBe(false);
    expect(validateUsername('nena-v').isValid).toBe(false);
  });
});

describe('3. Email Address Validation Rules', () => {
  it('accepts standard valid email addresses', () => {
    expect(validateEmail('nena.villanueva@gmail.com').isValid).toBe(true);
    expect(validateEmail('user@domain.com').isValid).toBe(true);
    expect(validateEmail('jaeda.iral@teamohmygrid.ph').isValid).toBe(true);
  });

  it('rejects invalid email formats', () => {
    expect(validateEmail('').isValid).toBe(false);
    expect(validateEmail('plainaddress').isValid).toBe(false);
    expect(validateEmail('missingatdomain.com').isValid).toBe(false);
    expect(validateEmail('user@domain').isValid).toBe(false);
    expect(validateEmail('user@.com').isValid).toBe(false);
  });
});

describe('4. Customer and Account Number (CAN) Rules', () => {
  it('accepts exactly 10 numeric digits', () => {
    expect(validateCAN('1234567890').isValid).toBe(true);
    expect(validateCAN('9876543210').isValid).toBe(true);
    expect(validateCAN('1029384756').isValid).toBe(true);
  });

  it('cleans and validates formatted CAN (1234-5678-90)', () => {
    const formatted = '1234-5678-90';
    expect(cleanCAN(formatted)).toBe('1234567890');
    expect(validateCAN(cleanCAN(formatted)).isValid).toBe(true);
  });

  it('rejects CAN with length !== 10', () => {
    expect(validateCAN('12345').isValid).toBe(false);
    expect(validateCAN('12345678901').isValid).toBe(false);
    expect(validateCAN('').isValid).toBe(false);
  });

  it('correctly formats 10 digits as SIN display (XXXX-XXXX-XX)', () => {
    expect(formatCANDisplay('1234567890')).toBe('1234-5678-90');
    expect(formatCANDisplay('9876543210')).toBe('9876-5432-10');
  });
});

describe('5. Password & Confirm Password Rules', () => {
  it('accepts passwords with min 8 chars containing letter and number', () => {
    expect(validatePassword('P@ssword123').isValid).toBe(true);
    expect(validatePassword('kuryente2026').isValid).toBe(true);
    expect(validatePassword('Secret12').isValid).toBe(true);
  });

  it('rejects passwords shorter than 8 characters', () => {
    expect(validatePassword('Pass1').isValid).toBe(false);
  });

  it('rejects passwords without letters', () => {
    expect(validatePassword('123456789').isValid).toBe(false);
  });

  it('rejects passwords without numbers', () => {
    expect(validatePassword('PasswordOnly').isValid).toBe(false);
  });

  it('accurately calculates password strength score', () => {
    const weak = evaluatePassword('pass1234');
    expect(weak.score).toBeLessThanOrEqual(3);

    const strong = evaluatePassword('Str0ng!P@ss2026');
    expect(strong.hasMinLength).toBe(true);
    expect(strong.hasLetter).toBe(true);
    expect(strong.hasNumber).toBe(true);
    expect(strong.hasUppercase).toBe(true);
    expect(strong.hasSpecialChar).toBe(true);
    expect(strong.score).toBe(5);
    expect(strong.strengthLabel).toBe('Strong');
  });

  it('validates matching confirm password', () => {
    expect(validateConfirmPassword('MyPass123', 'MyPass123').isValid).toBe(true);
    expect(validateConfirmPassword('MyPass123', 'OtherPass123').isValid).toBe(false);
  });
});

describe('6. Multi-Identifier Login Detection', () => {
  it('detects email as identifier', () => {
    expect(detectIdentifierType('nena@meralco.com.ph')).toBe('email');
    expect(detectIdentifierType('user@domain.com')).toBe('email');
  });

  it('detects 10-digit CAN as identifier', () => {
    expect(detectIdentifierType('1234567890')).toBe('can');
    expect(detectIdentifierType('1234-5678-90')).toBe('can');
  });

  it('detects alphanumeric username as identifier', () => {
    expect(detectIdentifierType('nenav2026')).toBe('username');
    expect(detectIdentifierType('jaeda12')).toBe('username');
  });

  it('flags invalid identifiers', () => {
    expect(detectIdentifierType('bad email @ com')).toBe('invalid');
    expect(detectIdentifierType('123')).toBe('invalid');
    expect(detectIdentifierType('abc')).toBe('invalid');
  });

  it('validates login identifier correctly', () => {
    expect(validateLoginIdentifier('nena@example.com').isValid).toBe(true);
    expect(validateLoginIdentifier('1234567890').isValid).toBe(true);
    expect(validateLoginIdentifier('nenav2026').isValid).toBe(true);
    expect(validateLoginIdentifier('ab').isValid).toBe(false);
  });
});
