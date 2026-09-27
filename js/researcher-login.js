(function () {
  const form = document.getElementById('researcherLoginForm');
  const message = document.getElementById('researcherLoginMessage');
  const submit = document.getElementById('researcherLoginSubmit');

  function showMessage(text, isError = false) {
    message.textContent = text;
    message.classList.remove('hidden');
    message.classList.toggle('error', isError);
  }

  form?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!window.db) return showMessage('Authentication service is not configured.', true);
    submit.disabled = true;
    showMessage('Signing in...');
    try {
      const email = document.getElementById('researcherLoginEmail').value.trim().toLowerCase();
      const password = document.getElementById('researcherLoginPassword').value;
      const { data, error } = await window.db.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.session?.user) throw new Error('Please confirm your email before signing in.');

      const { data: profile, error: profileError } = await window.db
        .from('profiles')
        .select('id, role')
        .eq('id', data.session.user.id)
        .maybeSingle();
      if (profileError) throw profileError;
      if (profile?.role !== 'researcher') {
        await window.db.auth.signOut();
        throw new Error('This account is not registered as a researcher.');
      }

      window.location.replace('researcher-portal.html');
    } catch (error) {
      console.error('Researcher sign-in failed:', error);
      showMessage(error.message || 'Unable to sign in.', true);
    } finally {
      submit.disabled = false;
    }
  });
})();