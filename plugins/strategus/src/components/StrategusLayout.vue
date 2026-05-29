<template>
  <div class="strategus-layout">
    <div class="strategus-page-shell">
      <SidebarNav />
      <main class="strategus-detail">
        <slot />
      </main>
    </div>
  </div>
</template>
<script setup lang="ts">
import SidebarNav from './SidebarNav.vue';
</script>
<style scoped>
.strategus-layout {
  height: calc(100vh - 60px);
  padding: 24px;
  background: #f6f7f9;
  overflow: hidden;
}
.strategus-page-shell {
  display: flex;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(15,23,42,.08), 0 8px 24px rgba(15,23,42,.04);
  height: 100%;
  overflow: hidden;
}
.strategus-detail {
  flex: 1;
  overflow-y: auto;
  padding: 28px 32px;
}
</style>

<!-- Global (non-scoped) styles for content rendered via <slot/>.
     :deep() only pierces direct descendants of the scoped component;
     slotted content rendered by sibling Vue components is out of scope. -->
<style>
/* Page header — match Atlas3 landing's hero (large light title) */
.strategus-detail h1.text-h4 { font-size: 34px !important; font-weight: 300 !important; line-height: 1.2; color: rgb(31, 66, 90); }
.strategus-detail .text-subtitle-1 { font-size: 14px !important; font-weight: 400; color: rgba(0, 0, 0, .62); }
.strategus-detail .text-overline { font-size: 11px !important; letter-spacing: 0.1em; line-height: 1.4; color: rgba(0, 0, 0, .54); font-weight: 500; }
.strategus-detail .text-body-2 { font-size: 13px !important; }
.strategus-detail .text-caption { font-size: 12px !important; }

/* Inner cards within the page shell — flat sections separated by a thin
   divider rather than their own elevated card. The outer page shell
   already provides the white surface.
   `overflow: visible` lets the first row's floating field labels render
   above the card's content box (Vuetify's default is overflow:hidden
   which clips outlined-variant labels). */
.strategus-page-shell .v-card {
  box-shadow: none !important;
  background: transparent !important;
  border: none !important;
  border-radius: 0 !important;
  overflow: visible !important;
}
.strategus-page-shell .v-card + .v-card { border-top: 1px solid rgba(0,0,0,.06) !important; padding-top: 8px; }
.strategus-page-shell .v-card-title { padding: 0 0 8px !important; font-size: 13px !important; font-weight: 600 !important; color: rgba(0,0,0,.72); text-transform: uppercase; letter-spacing: 0.5px; }
.strategus-page-shell .v-card-text { padding: 0 0 16px !important; font-size: 13px; }
.strategus-page-shell .v-card-actions { padding: 8px 0; }
.strategus-page-shell .v-card > .v-divider { display: none; }

/* Dialogs keep their card shadow */
.strategus-detail .v-dialog .v-card {
  background: #fff !important;
  box-shadow: 0 10px 40px rgba(0,0,0,.2) !important;
  border-radius: 12px !important;
}
.strategus-detail .v-dialog .v-card-title { padding: 14px 20px !important; font-size: 15px !important; text-transform: none !important; letter-spacing: 0 !important; color: rgba(0,0,0,.87) !important; }
.strategus-detail .v-dialog .v-card-text { padding: 16px 20px !important; }

/* Form fields — slim them down (keep enough headroom for the floating
   label, which sits at the top of the field box. min-height < 40px
   clips the label when the field is in its "raised label" state). */
.strategus-detail .v-field { font-size: 13px !important; }
.strategus-detail .v-field__input { font-size: 13px !important; }
.strategus-detail .v-field--variant-outlined .v-field__outline { --v-field-border-opacity: 0.18; }
/* Don't override .v-label / .v-field-label font-size — Vuetify uses it to
   compute the outlined-notch size; forcing it to 13px clips floating
   labels from the top in the outlined variant. */
.strategus-detail .v-input--density-compact .v-input__details { min-height: 16px; padding-top: 2px; }

/* Selection controls */
.strategus-detail .v-selection-control--density-compact { --v-selection-control-size: 32px; }
.strategus-detail .v-selection-control .v-label { font-size: 13px !important; opacity: 0.87; }

/* Switch — make smaller */
.strategus-detail .v-switch .v-switch__track { height: 18px; width: 32px; opacity: 1; }
.strategus-detail .v-switch .v-switch__thumb { width: 14px; height: 14px; }

/* Buttons */
.strategus-detail .v-btn--size-small { font-size: 12px !important; min-height: 30px !important; padding: 0 12px !important; }
.strategus-detail .v-btn--size-default { font-size: 13px !important; min-height: 34px !important; padding: 0 14px !important; }
.strategus-detail .v-btn { letter-spacing: 0 !important; }

/* Tables */
.strategus-detail .v-table--density-compact > .v-table__wrapper > table > thead > tr > th,
.strategus-detail .v-table--density-compact > .v-table__wrapper > table > tbody > tr > td {
  height: 36px !important;
  padding: 4px 12px !important;
  font-size: 12px;
}
.strategus-detail .v-table--density-compact > .v-table__wrapper > table > thead > tr > th {
  font-weight: 500;
  color: rgba(0,0,0,.6);
  text-transform: uppercase;
  font-size: 10px;
  letter-spacing: 0.5px;
}

/* Chips */
.strategus-detail .v-chip--density-compact { font-size: 11px; height: 22px; padding: 0 8px; }

/* Tighter v-list */
.strategus-detail .v-list--density-compact .v-list-item { min-height: 32px; padding: 4px 12px; }
.strategus-detail .v-list-item-title { font-size: 13px !important; }
.strategus-detail .v-list-item-subtitle { font-size: 11px !important; }

/* Compact empty-state used by lists when nothing is added yet */
.strategus-detail .empty-state-compact {
  padding: 10px 14px;
  margin-bottom: 8px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
  background: rgba(0, 0, 0, 0.02);
  border: 1px dashed rgba(0, 0, 0, 0.08);
  border-radius: 8px;
}

/* Lightweight bordered table for inline lists */
.strategus-detail .bordered-table {
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}
.strategus-detail .bordered-table .v-table__wrapper { background: transparent !important; }

/* Sub-section label used inside Outcomes panel etc. */
.strategus-detail .sub-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: rgba(0, 0, 0, 0.55);
  margin-bottom: 6px;
}
.strategus-detail .sub-label__count {
  margin-left: 4px;
  font-weight: 400;
  color: rgba(0, 0, 0, 0.4);
  text-transform: none;
  letter-spacing: 0;
}
</style>
