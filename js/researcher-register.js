(function () {
  const form = document.getElementById('researcherRegistrationForm');
  const message = document.getElementById('researcherRegistrationMessage');
  const submit = document.getElementById('researcherRegistrationSubmit');

  function showMessage(text, isError = false) {
    if (!message) return;
    message.textContent = text;
    message.classList.remove('hidden');
    message.classList.toggle('error', isError);
  }

  function value(id) {
    return document.getElementById(id)?.value.trim() || '';
  }

  async function saveResearcherProfile(user) {
    const profile = {
      id: user.id,
      full_name: value('researcherName'),
      email: user.email,
      role: 'researcher',
      organisation: value('researcherInstitution'),
      location: value('researcherLocation'),
      research_areas: value('researcherAreas')
        .split(',')
        .map(area => area.trim())
        .filter(Boolean)
    };
    const { error: profileError } = await window.db.from('profiles').upsert(profile, { onConflict: 'id' });
    if (profileError) throw profileError;

    const { error: researcherError } = await window.db.from('researcher_profiles').upsert({
      profile_id: user.id,
      institution: value('researcherInstitution'),
      position: value('researcherPosition'),
      research_areas: value('researcherAreas'),
      orcid: value('researcherOrcid'),
      bio: value('researcherBio')
    }, { onConflict: 'profile_id' });
    if (researcherError) throw researcherError;
  }

  form?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const password = value('researcherPassword');
    if (password !== value('researcherPasswordConfirm')) {
      showMessage('Passwords do not match.', true);
      return;
    }
    if (!window.db) {
      showMessage('Authentication service is not configured.', true);
      return;
    }

    submit.disabled = true;
    showMessage('Creating your researcher account...');
    try {
      const { data, error } = await window.db.auth.signUp({
        email: value('researcherEmail').toLowerCase(),
        password,
        options: {
          emailRedirectTo: new URL('researcher-login.html', window.location.href).href,
          data: {
            full_name: value('researcherName'),
            role: 'researcher',
            organisation: value('researcherInstitution'),
            location: value('researcherLocation'),
            interests: value('researcherAreas').split(',').map(area => area.trim()).filter(Boolean),
            role_data: {
              institution: value('researcherInstitution'),
              position: value('researcherPosition'),
              researchAreas: value('researcherAreas'),
              orcid: value('researcherOrcid'),
              bio: value('researcherBio')
            }
          }
        }
      });
      if (error) throw error;
      if (!data?.user) throw new Error('The researcher account could not be created.');
      if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        throw new Error('An account with this email already exists. Please sign in instead.');
      }
      if (data.session) {
        await saveResearcherProfile(data.user);
        showMessage('Account created. Opening the researcher portal...');
        window.location.replace('researcher-portal.html');
      } else {
        showMessage('Account created. Confirm your email, then sign in to open the researcher portal.');
        form.reset();
      }
    } catch (error) {
      console.error('Researcher registration failed:', error);
      showMessage(error.message || 'Registration failed. Please try again.', true);
    } finally {
      submit.disabled = false;
    }
  });
})();
