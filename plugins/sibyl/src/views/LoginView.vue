<template>
  <div class="login-page">
    <AtlasCard padding="none" class="login-card" data-test="login-card">
      <div class="login-card__header">
        <img :src="ohdsiLogo" alt="OHDSI" height="44" class="login-card__logo" >
        <div class="login-card__brand">SIBYL</div>
        <h1 class="login-card__title">Welcome back</h1>
        <p class="login-card__subtitle">Sign in to continue</p>
      </div>

      <div class="login-card__body">
        <div
          v-if="error"
          class="login-card__error"
          role="alert"
          data-test="login-error"
        >
          <AtlasIcon size="18" color="error" class="mr-2">mdi-alert-circle-outline</AtlasIcon>
          <span>{{ error }}</span>
        </div>

        <v-form @submit.prevent="onSubmit">
          <AtlasTextField
            v-model="email"
            label="Email"
            type="email"
            prepend-icon="mdi-account-outline"
            autocomplete="username"
            :disabled="loading"
            data-test="login-email"
            class="mb-3"
          />
          <AtlasTextField
            v-model="password"
            label="Password"
            type="password"
            prepend-icon="mdi-lock-outline"
            autocomplete="current-password"
            :disabled="loading"
            data-test="login-password"
            class="mb-4"
          />
          <AtlasButton
            type="submit"
            variant="primary"
            size="lg"
            :loading="loading"
            class="login-card__submit"
            data-test="login-submit"
          >
            Sign in
          </AtlasButton>
        </v-form>
      </div>

      <div class="login-card__footer">SIBYL · OHDSI</div>
    </AtlasCard>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import ohdsiLogo from '@/assets/ohdsi-logo.png'
import { AtlasCard, AtlasIcon, AtlasTextField, AtlasButton } from '@ohdsi/atlas-ui'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function onSubmit() {
  error.value = ''
  loading.value = true
  try {
    await auth.login(email.value, password.value)
    const redirect = (route.query.redirect as string) || '/'
    await router.replace(redirect)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Sign in failed'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(31, 66, 90, 0.04);
}

.login-card {
  width: 100%;
  max-width: 440px;
  background: #ffffff;
  overflow: hidden;
}

.login-card__header {
  padding: 32px 32px 0;
  text-align: center;
}

.login-card__logo {
  display: block;
  margin: 0 auto 12px;
}

.login-card__brand {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgb(var(--v-theme-primary));
  margin-bottom: 24px;
}

.login-card__title {
  font-size: 22px;
  font-weight: 600;
  line-height: 1.2;
  color: rgba(0, 0, 0, 0.87);
  margin: 0 0 6px;
}

.login-card__subtitle {
  font-size: 14px;
  color: rgba(0, 0, 0, 0.55);
  margin: 0 0 28px;
}

.login-card__body {
  padding: 0 32px 24px;
}

.login-card__error {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 10px 12px;
  margin-bottom: 16px;
  background-color: rgba(255, 82, 82, 0.08);
  border: 1px solid rgba(255, 82, 82, 0.25);
  border-radius: 6px;
  color: rgba(0, 0, 0, 0.78);
  font-size: 13px;
  line-height: 1.4;
}

.login-card__submit {
  text-transform: none;
  letter-spacing: 0;
  font-weight: 500;
  margin-top: 4px;
  width: 100%;
}

.login-card__footer {
  padding: 16px;
  text-align: center;
  font-size: 11px;
  letter-spacing: 0.04em;
  color: rgba(0, 0, 0, 0.4);
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}
</style>
