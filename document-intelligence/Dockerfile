FROM python:3.11-slim
WORKDIR /app
RUN apt-get update \
	&& apt-get install -y --no-install-recommends libgomp1 libgl1 \
	&& rm -rf /var/lib/apt/lists/*
COPY document-intelligence/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir paddlepaddle==3.2.1 \
	-i https://www.paddlepaddle.org.cn/packages/stable/cpu/ \
	&& pip install --no-cache-dir -r /app/requirements.txt
COPY document-intelligence/app.py /app/app.py
EXPOSE 8090
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8090"]
