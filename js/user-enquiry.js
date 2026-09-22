(function () {
  function ensureEnquiryUI() {
    if (document.getElementById('openEnquiryBtn')) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'rmrdcEnquiryRoot';
    wrapper.innerHTML = `
      <button id="openEnquiryBtn" class="rmrdc-enquiry-float" type="button">💬 User Enquiry</button>

      <div id="userEnquiryModal" class="rmrdc-enquiry-modal hidden" role="dialog" aria-modal="true">
        <div class="rmrdc-enquiry-dialog">
          <div class="rmrdc-enquiry-head">
            <div>
              <p class="section-tag">RMRDC CAS Support</p>
              <h2>User Enquiry Form</h2>
            </div>
            <button id="closeEnquiryBtn" class="rmrdc-enquiry-close" type="button">×</button>
          </div>

          <form id="userEnquiryForm" class="rmrdc-enquiry-form">
            <div class="field">
              <label for="enquiryName">Full Name</label>
              <input id="enquiryName" type="text" required />
            </div>
            <div class="field">
              <label for="enquiryEmail">Email Address</label>
              <input id="enquiryEmail" type="email" required />
            </div>
            <div class="field">
              <label for="enquiryPhone">Phone / WhatsApp Number</label>
              <input id="enquiryPhone" type="tel" required />
            </div>
            <div class="field">
              <label for="enquiryType">Enquiry Type</label>
              <select id="enquiryType" required>
                <option value="">Select enquiry type</option>
                <option>Publication request</option>
                <option>Raw materials information</option>
                <option>Subscription / CAS alerts</option>
                <option>Technical support</option>
                <option>AI Librarian support</option>
                <option>Other</option>
              </select>
            </div>
            <div class="field span-two">
              <label for="enquiryMessage">Message</label>
              <textarea id="enquiryMessage" rows="5" required></textarea>
            </div>
            <button class="btn btn-primary span-two" type="submit">Submit Enquiry</button>
            <p id="enquiryStatus" class="notice hidden span-two"></p>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(wrapper);
  }

  function notice(text, err = false) {
    const statusBox = document.getElementById('enquiryStatus');
    if (!statusBox) return;
    statusBox.textContent = text;
    statusBox.classList.remove('hidden');
    statusBox.style.background = err ? '#fff1f1' : '#edf7f1';
    statusBox.style.color = err ? '#9b1c1c' : '#0d4d2e';
  }

  function openModal() {
    document.getElementById('userEnquiryModal')?.classList.remove('hidden');
  }

  function closeModal() {
    document.getElementById('userEnquiryModal')?.classList.add('hidden');
  }

  function bindEvents() {
    document.getElementById('openEnquiryBtn')?.addEventListener('click', openModal);
    document.getElementById('closeEnquiryBtn')?.addEventListener('click', closeModal);

    document.getElementById('userEnquiryModal')?.addEventListener('click', (event) => {
      if (event.target.id === 'userEnquiryModal') closeModal();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeModal();
    });

    document.getElementById('userEnquiryForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();

      const payload = {
        full_name: document.getElementById('enquiryName').value.trim(),
        email: document.getElementById('enquiryEmail').value.trim().toLowerCase(),
        phone: document.getElementById('enquiryPhone').value.trim(),
        enquiry_type: document.getElementById('enquiryType').value,
        message: document.getElementById('enquiryMessage').value.trim(),
        source_page: location.href,
        status: 'new'
      };

      try {
        if (!window.db) throw new Error('Supabase is not connected. Check js/config.js.');
        notice('Submitting your enquiry...');
        const { data, error } = await window.db.from('user_enquiries').insert(payload).select().single();
        if (error) throw error;

        const result = await window.db.functions.invoke('notify-enquiry', { body: { enquiry: data } });
        if (result.error) console.warn(result.error);

        notice('Your enquiry has been submitted. RMRDC Library will contact you by email or WhatsApp.');
        event.target.reset();
      } catch (err) {
        console.error(err);
        notice(err.message || 'Unable to submit enquiry.', true);
      }
    });
  }

  ensureEnquiryUI();
  bindEvents();
})();
