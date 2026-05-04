import requests

url = "https://prioritai-ml-973722445460.europe-west1.run.app/predict"

with open("test.jpg", "rb") as f:
    res = requests.post(
        url,
        data=f.read(),
        headers={"Content-Type": "application/octet-stream"}
    )

print(res.status_code)
print(res.text)