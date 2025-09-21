#!/bin/bash

# Этот скрипт принимает GitHub username и Personal Access Token (PAT) в качестве аргументов
# и генерирует правильную Base64-строку для секрета Kubernetes
# типа kubernetes.io/dockerconfigjson для доступа к ghcr.io.
#
# Использование: ./kuber-token.sh <github_username> <github_pat>

# 1. Проверка и чтение аргументов
if [ "$#" -ne 2 ]; then
    echo "Ошибка: Неверное количество аргументов."
    echo "Использование: $0 <github_username> <github_pat>"
    exit 1
fi

USERNAME=$1
TOKEN=$2

echo "Генерация секрета для пользователя: $USERNAME"

# 2. Определение правильного флага для base64 в зависимости от ОС
BASE64_WRAP_FLAG=""
if [[ "$(uname)" == "Linux" ]]; then
  BASE64_WRAP_FLAG="-w 0"
elif [[ "$(uname)" == "Darwin" ]]; then # Darwin - это ядро macOS
  BASE64_WRAP_FLAG="-b 0"
fi

# 3. Шаг 1: Кодируем строку 'username:token'
AUTH_STRING=$(echo -n "${USERNAME}:${TOKEN}" | base64)

# 4. Шаг 2: Формируем валидный JSON-объект
JSON_STRING=$(printf '{"auths":{"ghcr.io":{"auth":"%s"}}}' "$AUTH_STRING")

# 5. Шаг 3: Кодируем всю JSON-строку в Base64, используя правильный флаг
FINAL_STRING=$(echo -n "$JSON_STRING" | base64 ${BASE64_WRAP_FLAG})

# 6. Вывод результата
echo "------------------------------------------------------------------"
echo "СКРИПТ ЗАВЕРШЕН. Вот ваша финальная строка:"
echo ""
echo $FINAL_STRING
echo ""
echo "------------------------------------------------------------------"
echo "Вы можете скопировать и вставить весь этот блок в ваш файл"
echo "src/kubernetes/dockerconfigsecret.yaml:"
echo ""
# Используем cat с Heredoc для красивого вывода YAML
cat << EOF
apiVersion: v1
kind: Secret
metadata:
  name: dockerconfigjson
  namespace: cinemaabyss
data:
  .dockerconfigjson: $FINAL_STRING
type: kubernetes.io/dockerconfigjson
EOF
echo "------------------------------------------------------------------"
