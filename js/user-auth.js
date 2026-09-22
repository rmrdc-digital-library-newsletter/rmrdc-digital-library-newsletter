const loginForm = document.getElementById('loginForm');
const loginMessage = document.getElementById('loginMessage');
function showLoginMessage(message, isError=false) {
  if (!loginMessage) return;
  loginMessage.textContent = message;
  loginMessage.classList.remove('hidden');
  loginMessage.style.background = isError ? '#fff1f1' : '#edf7f1';
  loginMessage.style.color = isError ? '#9b1c1c' : '#0d4d2e';
}

(async function redirectIfLoggedIn(){
  if (!window.db) return showLoginMessage('Update js/config.js with your Supabase credentials.', true);
  try {
    const { data: { session } } = await window.db.auth.getSession();
    if (session?.user && window.RMRDCAuth) await window.RMRDCAuth.routeAfterLogin();
  } catch (e) {
    console.warn('Existing session check failed:', e);
  }
})();

loginForm?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  if (!window.db) return showLoginMessage('Authentication service is not configured.', true);
  showLoginMessage('Signing in...');
  const email=document.getElementById('loginEmail').value.trim().toLowerCase();
  const password=document.getElementById('loginPassword').value;
  const { data, error } = await window.db.auth.signInWithPassword({ email, password });
  if (error) return showLoginMessage(error.message, true);
  if (!data?.session) return showLoginMessage('Please confirm your email address before signing in.', true);
  showLoginMessage('Sign in successful. Opening your workspace...');
  await window.RMRDCAuth.routeAfterLogin();
});

document.getElementById('resetPasswordBtn')?.addEventListener('click', async ()=>{
  if (!window.db) return showLoginMessage('Authentication service is not configured.', true);
  const email=document.getElementById('loginEmail')?.value.trim().toLowerCase();
  if (!email) return showLoginMessage('Enter your email address first, then choose “Forgot password”.', true);
  const redirectTo = `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, '')}reset-password.html`;
  const { error } = await window.db.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) return showLoginMessage(error.message, true);
  showLoginMessage('Password reset instructions have been sent to your email.');
});
