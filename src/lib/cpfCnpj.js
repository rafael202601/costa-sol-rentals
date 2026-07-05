// Utilitários de formatação e validação de CPF/CNPJ

export function formatCPF(value) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

export function formatCNPJ(value) {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

export function formatCPFCNPJ(value) {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 11) return formatCPF(digits);
  return formatCNPJ(digits);
}

export function validarCPF(cpf) {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  // Bloquear sequências inválidas
  if (/^(\d)\1{10}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(digits[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  return rest === parseInt(digits[10]);
}

export function validarCNPJ(cnpj) {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;
  const calcDigit = (str, weights) => {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) sum += parseInt(str[i]) * weights[i];
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  if (calcDigit(digits, w1) !== parseInt(digits[12])) return false;
  return calcDigit(digits, w2) === parseInt(digits[13]);
}

// Detecta se é CPF (11 dígitos) ou CNPJ (14 dígitos)
export function detectarTipo(value) {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 11) return "cpf";
  return "cnpj";
}

// Valida conforme tipo de perfil: "comum" => CPF, "cnpj" => CNPJ, "empreiteiro" => qualquer
export function validarDocumento(value, tipoPerfil) {
  const digits = value.replace(/\D/g, "");
  if (tipoPerfil === "comum") {
    if (digits.length === 14) return { valid: false, erro: "Este documento é um CNPJ. Utilize o cadastro de Cliente CNPJ.", tipo: "cnpj_no_comum" };
    if (!validarCPF(digits)) return { valid: false, erro: "CPF inválido. Verifique os dígitos informados." };
    return { valid: true };
  }
  if (tipoPerfil === "cnpj") {
    if (digits.length === 11) return { valid: false, erro: "Este documento é um CPF. Utilize o cadastro de Cliente Comum.", tipo: "cpf_no_cnpj" };
    if (!validarCNPJ(digits)) return { valid: false, erro: "CNPJ inválido. Verifique os dígitos informados." };
    return { valid: true };
  }
  if (tipoPerfil === "empreiteiro") {
    if (digits.length === 11) {
      if (!validarCPF(digits)) return { valid: false, erro: "CPF inválido. Verifique os dígitos informados." };
      return { valid: true };
    }
    if (digits.length === 14) {
      if (!validarCNPJ(digits)) return { valid: false, erro: "CNPJ inválido. Verifique os dígitos informados." };
      return { valid: true };
    }
    return { valid: false, erro: "Formato incorreto. Informe um CPF (11 dígitos) ou CNPJ (14 dígitos)." };
  }
  return { valid: true };
}