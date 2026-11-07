const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('aiChatForm');
const chatInput = document.getElementById('aiChatInput');
const chatSendButton = chatForm?.querySelector('button[type="submit"], button:not([type])');

function addMessage(role, text, sources = []) {
	const message = document.createElement('article');
	message.className = `chat-bubble ${role}`;

	const heading = document.createElement('strong');
	heading.textContent = role === 'assistant' ? 'AI Research Assistant' : 'You';
	message.appendChild(heading);

	const paragraph = document.createElement('p');
	paragraph.textContent = text;
	message.appendChild(paragraph);

	if (sources.length) {
		const sourceList = document.createElement('div');
		sourceList.className = 'ai-answer-sources';
		const sourceHeading = document.createElement('strong');
		sourceHeading.textContent = 'Sources';
		sourceList.appendChild(sourceHeading);

		sources.forEach(source => {
			if (!source?.publication_id || !source?.title) return;
			const sourceLink = document.createElement('a');
			const page = Number(source.page);
			const viewerUrl = new URL(`viewer.html?id=${encodeURIComponent(source.publication_id)}${page > 0 ? `#page/${Math.floor(page)}` : ''}`, window.location.href);
			sourceLink.href = viewerUrl.href;
			sourceLink.textContent = `${source.title}${source.year ? `, ${source.year}` : ''}${page > 0 ? ` - p. ${Math.floor(page)}` : ' - Research Intelligence Profile'}`;
			sourceLink.target = '_blank';
			sourceLink.rel = 'noopener';
			sourceList.appendChild(sourceLink);
		});
		if (sourceList.querySelector('a')) message.appendChild(sourceList);
	}

	chatMessages.appendChild(message);
	chatMessages.scrollTop = chatMessages.scrollHeight;
	return message;
}

async function askAILibrarian(question) {
	if (!window.db) throw new Error('The RMRDC Research Assistant is temporarily unavailable.');
	const { data, error } = await window.db.functions.invoke('ai-librarian', { body: { question } });
	if (error || !data?.answer) throw new Error('The RMRDC Research Assistant is temporarily unavailable. Please try again.');
	return data;
}

chatForm?.addEventListener('submit', async event => {
	event.preventDefault();
	const question = chatInput.value.trim();
	if (!question) return;

	addMessage('user', question);
	chatInput.value = '';
	const pending = addMessage('assistant', 'Searching RMRDC publications and research profiles...');
	if (chatSendButton) chatSendButton.disabled = true;

	try {
		const result = await askAILibrarian(question);
		pending.querySelector('p').textContent = result.answer;
		if (Array.isArray(result.sources)) {
			const sourceList = document.createElement('div');
			sourceList.className = 'ai-answer-sources';
			const sourceHeading = document.createElement('strong');
			sourceHeading.textContent = 'Sources';
			sourceList.appendChild(sourceHeading);
			result.sources.forEach(source => {
				if (!source?.publication_id || !source?.title) return;
				const link = document.createElement('a');
				const page = Number(source.page);
				link.href = `viewer.html?id=${encodeURIComponent(source.publication_id)}${page > 0 ? `#page/${Math.floor(page)}` : ''}`;
				link.textContent = `${source.title}${source.year ? `, ${source.year}` : ''}${page > 0 ? ` - p. ${Math.floor(page)}` : ' - Research Intelligence Profile'}`;
				link.target = '_blank';
				link.rel = 'noopener';
				sourceList.appendChild(link);
			});
			if (sourceList.querySelector('a')) pending.appendChild(sourceList);
		}
		if (!result.evidenceFound) pending.classList.add('no-evidence');
	} catch (error) {
		pending.querySelector('p').textContent = 'The RMRDC Research Assistant is temporarily unavailable. Please try again.';
		pending.classList.add('error');
	} finally {
		if (chatSendButton) chatSendButton.disabled = false;
		chatInput.focus();
	}
});