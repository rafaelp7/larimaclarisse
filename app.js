const SUPABASE_URL = 'https://oqkbhaabtnpjmxsdewtc.supabase.co'; //[cite: 1]
const SUPABASE_KEY = 'SUA_CHAVE_ANON_AQUI';

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const statusMsg = document.getElementById('status-msg');
const loginSection = document.getElementById('login-section');
const dashSection = document.getElementById('dashboard-section');
const userInfo = document.getElementById('user-info');

function setStatus(msg) {
  statusMsg.innerText = msg;
}

function showDashboard(email) {
  loginSection.style.display = 'none';
  dashSection.style.display = 'block';
  userInfo.innerText = `Conectado como: ${email}`;
  setStatus('');
}

// 1. Login com Usuário e Senha (Supabase Auth nativo)
document.getElementById('btn-password').addEventListener('click', async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    setStatus('Preencha o e-mail e a senha.');
    return;
  }

  setStatus('Autenticando...');
  const { data, error } = await sb.auth.signInWithPassword({
    email: email,
    password: password
  });

  if (error) {
    setStatus('Falha no login: ' + error.message);
  } else {
    localStorage.setItem('user_email', email);
    showDashboard(email);
  }
});

// 2. Cadastrar Biometria / Passkey do Celular ou Computador
document.getElementById('btn-register-passkey').addEventListener('click', async () => {
  const email = localStorage.getItem('user_email');
  if (!window.PublicKeyCredential) {
    setStatus('Este navegador não suporta autenticação biométrica nativa.');
    return;
  }

  try {
    setStatus('Confirme sua digital ou rosto no dispositivo...');
    const challenge = window.crypto.getRandomValues(new Uint8Array(32));
    const userId = new Uint8Array(16);
    window.crypto.getRandomValues(userId);

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: challenge,
        rp: { name: "Lar Irmã Clarice" },
        user: {
          id: userId,
          name: email,
          displayName: email
        },
        pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
        authenticatorSelection: {
          authenticatorAttachment: "platform", // Ativa Face ID, Digital do celular ou Windows Hello
          userVerification: "required"
        },
        timeout: 60000
      }
    });

    if (credential) {
      const credIdBase64 = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));

      // Salva no Supabase e no aparelho local
      await sb.from('user_passkeys').insert([
        { user_email: email, credential_id: credIdBase64, device_name: navigator.userAgent.slice(0, 50) }
      ]);

      localStorage.setItem(`passkey_${email}`, credIdBase64);
      setStatus('Biometria / Smart phone cadastrado com sucesso!');
    }
  } catch (err) {
    setStatus('Não foi possível registrar a biometria: ' + err.message);
  }
});

// 3. Login com Biometria / Facial / Digital
document.getElementById('btn-biometric').addEventListener('click', async () => {
  const email = emailInput.value.trim();
  if (!email) {
    setStatus('Digite seu e-mail acima primeiro.');
    return;
  }

  // Busca a credencial cadastrada (no navegador ou no Supabase)
  let credIdBase64 = localStorage.getItem(`passkey_${email}`);

  if (!credIdBase64) {
    const { data } = await sb.from('user_passkeys').select('credential_id').eq('user_email', email).limit(1);
    if (data && data.length > 0) {
      credIdBase64 = data[0].credential_id;
    }
  }

  if (!credIdBase64) {
    setStatus('Nenhuma biometria vinculada. Entre com e-mail e senha primeiro e clique em "Ativar Biometria".');
    return;
  }

  try {
    setStatus('Aproxime o dedo ou aponte o rosto...');
    const challenge = window.crypto.getRandomValues(new Uint8Array(32));
    const credId = Uint8Array.from(atob(credIdBase64), c => c.charCodeAt(0));

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: challenge,
        allowCredentials: [{
          id: credId,
          type: 'public-key'
        }],
        userVerification: 'required'
      }
    });

    if (assertion) {
      localStorage.setItem('user_email', email);
      showDashboard(email);
    }
  } catch (err) {
    setStatus('Validação biométrica cancelada ou não reconhecida.');
  }
});

// 4. Logout
document.getElementById('btn-logout').addEventListener('click', async () => {
  await sb.auth.signOut();
  localStorage.removeItem('user_email');
  dashSection.style.display = 'none';
  loginSection.style.display = 'block';
  setStatus('');
});
