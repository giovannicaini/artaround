import { LitElement, html, nothing } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { userService } from '../../services/user.service';
import { museumService } from '../../services/museum.service';
import { artworkService } from '../../services/artwork.service';
import { itemService } from '../../services/item.service';
import { visitService } from '../../services/visit.service';
import {
  type User,
  UserRole,
  ContextualRole,
  ResourceType,
  type RoleAssignment,
  type CreateUserData,
  type UpdateUserData,
  type RoleAssignmentData,
} from '@artaround/shared';
import '../ui/ui-button';
import '../ui/ui-card';
import '../ui/ui-icon';
import '../ui/ui-input';
import '../ui/ui-select';
import '../ui/ui-badge';
import '../ui/ui-modal';
import '../ui/ui-image-placeholder';
import '../ui/ui-page-header';
import '../ui/ui-loading';
import '../ui/ui-empty';
import '../ui/ui-alert';
import '../ui/ui-pagination';
import '../ui/ui-search-bar';
import '../ui/ui-section';
import '../ui/ui-icon-button';
import '../ui/ui-checkbox';
import '../ui/ui-filter-tabs';
import '../ui/ui-search-list-picker';
import '../ui/ui-panel-section';
import { __ } from '../../services/i18n.service';

type ViewMode = 'list' | 'create' | 'edit' | 'view';

interface UserFormData {
  username: string;
  email: string;
  password: string;
  role: UserRole;
  isActive: boolean;
}

@customElement('users-page')
export class UsersPage extends LitElement {
  @property({ type: Object }) currentUser: User | null = null;

  @state() private viewMode: ViewMode = 'list';
  @state() private users: User[] = [];
  @state() private selectedUser: User | null = null;
  @state() private loading = true;
  @state() private saving = false;
  @state() private error = '';
  @state() private success = '';

  // Pagination
  @state() private page = 1;
  @state() private totalPages = 1;
  @state() private total = 0;

  // Filters
  @state() private searchQuery = '';
  @state() private filterRole: UserRole | '' = '';
  @state() private filterActive: 'all' | 'active' | 'inactive' = 'all';

  // Form data
  @state() private formData: UserFormData = {
    username: '',
    email: '',
    password: '',
    role: UserRole.VISITOR,
    isActive: true,
  };

  // Resource name lookup (id → name)
  @state() private resourceNames: Map<string, string> = new Map();

  // Resource options for resource picker in role modal
  @state() private resourceOptions: { value: string; label: string }[] = [];
  @state() private resourceOptionsLoading = false;

  // Delete modal
  @state() private deleteModalOpen = false;
  @state() private userToDelete: User | null = null;
  @state() private deleting = false;

  // Role assignment modal
  @state() private roleAssignmentModalOpen = false;
  @state() private roleAssignmentData: RoleAssignmentData = {
    role: ContextualRole.VIEWER,
    resourceType: ResourceType.ITEM,
    resourceId: '',
  };

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.loadUsers();
    this.loadResourceNames();
  }

  private async loadResourceNames() {
    const museums = await museumService.getMuseums();
    const map = new Map<string, string>();
    for (const m of museums) {
      map.set(m._id, m.name);
      if (m.wikidataId) map.set(m.wikidataId, m.name);
    }
    this.resourceNames = map;
  }

  private getRoleAssignmentLabel(ra: RoleAssignment): string {
    const roleLabel = userService.getContextualRoleLabel(ra.role);
    const typeLabel = userService.getResourceTypeLabel(ra.resourceType);
    const resourceName = this.resourceNames.get(ra.resourceId);
    return resourceName
      ? `${roleLabel} — ${typeLabel} "${resourceName}"`
      : `${roleLabel} — ${typeLabel} (${ra.resourceId.slice(-6)})`;
  }

  updated(changedProps: Map<string, unknown>) {
    if (changedProps.has('viewMode')) {
      window.scrollTo(0, 0);
    }
  }

  private async loadUsers() {
    this.loading = true;
    this.error = '';

    try {
      const params: Record<string, unknown> = {
        page: this.page,
        limit: 20,
      };

      if (this.searchQuery) params.search = this.searchQuery;
      if (this.filterRole) params.role = this.filterRole;
      if (this.filterActive !== 'all') params.isActive = this.filterActive === 'active';

      const response = await userService.getUsers(
        params as Parameters<typeof userService.getUsers>[0],
      );
      this.users = response.users;
      this.totalPages = response.pagination.pages;
      this.total = response.pagination.total;
    } catch (e) {
      console.error('Error loading users:', e);
      this.error = __('Errore nel caricamento degli utenti');
    } finally {
      this.loading = false;
    }
  }

  private handleFilterRole(role: UserRole | '') {
    this.filterRole = role;
    this.page = 1;
    this.loadUsers();
  }

  private handleFilterActive(filter: 'all' | 'active' | 'inactive') {
    this.filterActive = filter;
    this.page = 1;
    this.loadUsers();
  }

  private handlePageChange(newPage: number) {
    this.page = newPage;
    this.loadUsers();
  }

  private openCreateForm() {
    this.formData = {
      username: '',
      email: '',
      password: '',
      role: UserRole.VISITOR,
      isActive: true,
    };
    this.viewMode = 'create';
    this.error = '';
    this.success = '';
  }

  private openEditForm(user: User) {
    this.selectedUser = user;
    this.formData = {
      username: user.username,
      email: user.email,
      password: '', // Don't populate password
      role: user.role,
      isActive: user.isActive,
    };
    this.viewMode = 'edit';
    this.error = '';
    this.success = '';
  }

  private openViewUser(user: User) {
    this.selectedUser = user;
    this.viewMode = 'view';
  }

  private handleCancel() {
    this.viewMode = 'list';
    this.selectedUser = null;
    this.error = '';
    this.success = '';
  }

  private async handleSubmit() {
    this.error = '';
    this.success = '';

    // Validation
    if (!this.formData.username.trim()) {
      this.error = __('Username obbligatorio');
      return;
    }
    if (!this.formData.email.trim()) {
      this.error = 'Email obbligatoria';
      return;
    }
    if (this.viewMode === 'create' && !this.formData.password) {
      this.error = 'Password obbligatoria';
      return;
    }

    this.saving = true;

    try {
      if (this.viewMode === 'create') {
        const data: CreateUserData = {
          username: this.formData.username.trim(),
          email: this.formData.email.trim(),
          password: this.formData.password,
          role: this.formData.role,
          isActive: this.formData.isActive,
        };
        await userService.create(data);
        this.success = __('Utente creato con successo!');
      } else if (this.viewMode === 'edit' && this.selectedUser) {
        const data: UpdateUserData = {
          username: this.formData.username.trim(),
          email: this.formData.email.trim(),
          role: this.formData.role,
          isActive: this.formData.isActive,
        };
        if (this.formData.password) {
          data.password = this.formData.password;
        }
        await userService.update(this.selectedUser._id, data);
        this.success = __('Utente aggiornato con successo!');
      }

      // Refresh list and go back
      await this.loadUsers();
      setTimeout(() => {
        this.viewMode = 'list';
        this.selectedUser = null;
      }, 1000);
    } catch (e) {
      console.error('Error saving user:', e);
      this.error = e instanceof Error ? e.message : __('Errore nel salvataggio');
    } finally {
      this.saving = false;
    }
  }

  private openDeleteModal(user: User) {
    this.userToDelete = user;
    this.deleteModalOpen = true;
  }

  private async handleConfirmDelete() {
    if (!this.userToDelete) return;

    this.deleting = true;
    try {
      await userService.delete(this.userToDelete._id);
      await this.loadUsers();
      this.deleteModalOpen = false;
      this.userToDelete = null;
    } catch (e) {
      console.error('Error deleting user:', e);
    } finally {
      this.deleting = false;
    }
  }

  // Role assignment methods
  private openRoleAssignmentModal(user: User) {
    this.selectedUser = user;
    this.roleAssignmentData = {
      role: ContextualRole.VIEWER,
      resourceType: ResourceType.MUSEUM,
      resourceId: '',
    };
    this.roleAssignmentModalOpen = true;
    this.loadResourceOptions(ResourceType.MUSEUM);
  }

  private async loadResourceOptions(type: ResourceType) {
    this.resourceOptionsLoading = true;
    this.resourceOptions = [];
    try {
      if (type === ResourceType.MUSEUM) {
        const museums = await museumService.getMuseums();
        this.resourceOptions = museums.map((m) => ({ value: m._id, label: m.name }));
      } else if (type === ResourceType.ITEM) {
        const res = await itemService.getItems({ limit: 200 });
        this.resourceOptions = res.items.map((i) => ({ value: i._id, label: i.title }));
      } else if (type === ResourceType.ARTWORK) {
        const res = await artworkService.getArtworks({ limit: 200 });
        this.resourceOptions = res.artworks.map((a) => ({ value: a._id, label: a.title }));
      } else if (type === ResourceType.VISIT) {
        const res = await visitService.getVisits({ limit: 200 });
        this.resourceOptions = res.visits.map((v) => ({ value: v._id, label: v.title }));
      }
    } catch (e) {
      console.error('Error loading resource options:', e);
      this.resourceOptions = [];
    } finally {
      this.resourceOptionsLoading = false;
      this.requestUpdate();
    }
  }

  private async handleAddRoleAssignment() {
    if (!this.selectedUser || !this.roleAssignmentData.resourceId) {
      this.error = __('ID risorsa obbligatorio');
      return;
    }

    this.saving = true;
    try {
      const updatedUser = await userService.addRoleAssignment(
        this.selectedUser._id,
        this.roleAssignmentData,
      );
      this.selectedUser = updatedUser;

      // Update user in list
      this.users = this.users.map((u) => (u._id === updatedUser._id ? updatedUser : u));

      this.roleAssignmentModalOpen = false;
      this.success = __('Ruolo assegnato con successo!');
    } catch (e) {
      console.error('Error adding role assignment:', e);
      this.error = e instanceof Error ? e.message : __("Errore nell'assegnazione del ruolo");
    } finally {
      this.saving = false;
    }
  }

  private async handleRemoveRoleAssignment(assignment: RoleAssignment) {
    if (!this.selectedUser) return;

    try {
      const updatedUser = await userService.removeRoleAssignment(this.selectedUser._id, {
        role: assignment.role,
        resourceType: assignment.resourceType,
        resourceId: assignment.resourceId,
      });
      this.selectedUser = updatedUser;

      // Update user in list
      this.users = this.users.map((u) => (u._id === updatedUser._id ? updatedUser : u));
    } catch (e) {
      console.error('Error removing role assignment:', e);
    }
  }

  render() {
    return html`
      <div class="users-page">
        ${this.viewMode === 'list' ? this.renderList() : nothing}
        ${this.viewMode === 'create' || this.viewMode === 'edit' ? this.renderForm() : nothing}
        ${this.viewMode === 'view' ? this.renderUserDetail() : nothing} ${this.renderDeleteModal()}
        ${this.renderRoleAssignmentModal()}
      </div>
    `;
  }

  private renderList() {
    return html`
      <!-- Header -->
      <ui-page-header
        .title=${__('Gestione Utenti')}
        .count=${this.total}
        .countLabel=${__('utenti')}
      >
        <ui-button
          slot="actions"
          variant="primary"
          icon="plus"
          .label=${__('Nuovo Utente')}
          @click=${this.openCreateForm}
        ></ui-button>
      </ui-page-header>

      <!-- Filters -->
      <div class="flex flex-col lg:flex-row gap-4 mb-6">
        <div class="flex-1">
          <ui-search-bar
            .placeholder=${`🔍 ${__('Cerca per nome o email...')}`}
            .value=${this.searchQuery}
            .showButton=${false}
            @search=${(e: CustomEvent) => {
              this.searchQuery = e.detail.value;
              this.page = 1;
              this.loadUsers();
            }}
          ></ui-search-bar>
        </div>

        <div class="flex flex-wrap gap-2">
          <!-- Role filter -->
          <ui-filter-tabs
            .tabs=${[
              { value: '', label: __('Tutti') },
              ...Object.values(UserRole).map((role) => ({
                value: role,
                label: userService.getRoleLabel(role),
              })),
            ]}
            .value=${this.filterRole}
            @filter-change=${(e: CustomEvent) => this.handleFilterRole(e.detail.value)}
          ></ui-filter-tabs>

          <!-- Active filter -->
          <ui-filter-tabs
            .tabs=${[
              { value: 'all', label: __('Tutti') },
              { value: 'active', label: __('Attivi') },
              { value: 'inactive', label: __('Inattivi') },
            ]}
            .value=${this.filterActive}
            @filter-change=${(e: CustomEvent) => this.handleFilterActive(e.detail.value)}
          ></ui-filter-tabs>
        </div>
      </div>

      <!-- Error message -->
      ${this.error
        ? html`<ui-alert variant="danger" .message=${this.error} class="mb-4"></ui-alert>`
        : nothing}

      <!-- Users table -->
      ${this.loading
        ? html`<ui-loading size="lg" .text=${__('Caricamento utenti...')}></ui-loading>`
        : this.users.length === 0
          ? html`<ui-empty
              icon="users"
              .title=${__('Nessun utente trovato')}
              .description=${this.searchQuery || this.filterRole || this.filterActive !== 'all'
                ? __('Prova a modificare i filtri di ricerca')
                : __('Crea il primo utente per iniziare')}
            >
              <ui-button
                slot="action"
                variant="primary"
                icon="plus"
                .label=${__('Nuovo Utente')}
                @click=${this.openCreateForm}
              ></ui-button>
            </ui-empty>`
          : this.renderUsersTable()}

      <!-- Pagination -->
      ${this.totalPages > 1
        ? html`<ui-pagination
            .page=${this.page}
            .totalPages=${this.totalPages}
            @page-change=${(e: CustomEvent) => this.handlePageChange(e.detail.page)}
          ></ui-pagination>`
        : nothing}
    `;
  }

  private renderUsersTable() {
    return html`
      <ui-card padding="none">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-surface-50 dark:bg-surface-800/50">
              <tr>
                <th
                  class="px-4 py-3 text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider"
                >
                  ${__('Utente')}
                </th>
                <th
                  class="px-4 py-3 text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider"
                >
                  ${__('Ruolo')}
                </th>
                <th
                  class="px-4 py-3 text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider"
                >
                  ${__('Ruoli Contestuali')}
                </th>
                <th
                  class="px-4 py-3 text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider"
                >
                  ${__('Stato')}
                </th>
                <th
                  class="px-4 py-3 text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider"
                >
                  ${__('Creato')}
                </th>
                <th
                  class="px-4 py-3 text-right text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider"
                >
                  ${__('Azioni')}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-surface-200 dark:divide-surface-700">
              ${this.users.map((user) => this.renderUserRow(user))}
            </tbody>
          </table>
        </div>
      </ui-card>
    `;
  }

  private getRoleBadgeVariant(role: UserRole): string {
    const roleColors: Record<UserRole, string> = {
      admin: 'danger',
      curator: 'primary',
      author: 'success',
      visitor: 'secondary',
    };

    return roleColors[role] || 'secondary';
  }

  private renderRoleBadge(role: UserRole, variant?: string) {
    return html`
      <ui-badge
        variant="${variant || this.getRoleBadgeVariant(role)}"
        .label=${userService.getRoleLabel(role)}
      ></ui-badge>
    `;
  }

  private renderStatusBadge(isActive: boolean) {
    return isActive
      ? html`<ui-badge variant="success" dot .label=${__('Attivo')}></ui-badge>`
      : html`<ui-badge variant="secondary" dot .label=${__('Inattivo')}></ui-badge>`;
  }

  private formatUserDate(
    value?: string | Date,
    options?: Intl.DateTimeFormatOptions,
    fallback = '-',
  ) {
    if (!value) return fallback;
    return new Date(value).toLocaleDateString('it-IT', options);
  }

  private renderUserRow(user: User) {
    return html`
      <tr class="hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors">
        <td class="px-4 py-3">
          <div class="flex items-center gap-3">
            <div
              class="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-700 dark:text-brand-300 font-semibold"
            >
              ${user.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <p class="font-medium text-surface-900 dark:text-white">${user.username}</p>
              <p class="text-sm text-surface-500">${user.email}</p>
            </div>
          </div>
        </td>
        <td class="px-4 py-3">${this.renderRoleBadge(user.role)}</td>
        <td class="px-4 py-3">
          ${user.roleAssignments && user.roleAssignments.length > 0
            ? html`
                <div class="flex flex-wrap gap-1">
                  ${user.roleAssignments
                    .slice(0, 2)
                    .map(
                      (ra) => html`
                        <ui-badge
                          variant="outline"
                          size="sm"
                          .label=${this.getRoleAssignmentLabel(ra)}
                        ></ui-badge>
                      `,
                    )}
                  ${user.roleAssignments.length > 2
                    ? html`<ui-badge
                        variant="outline"
                        size="sm"
                        .label=${`+${user.roleAssignments.length - 2}`}
                      ></ui-badge>`
                    : nothing}
                </div>
              `
            : html`<span class="text-sm text-surface-400">—</span>`}
        </td>
        <td class="px-4 py-3">${this.renderStatusBadge(user.isActive)}</td>
        <td class="px-4 py-3 text-sm text-surface-500">${this.formatUserDate(user.createdAt)}</td>
        <td class="px-4 py-3">
          <div class="flex items-center justify-end gap-1">
            <ui-icon-button
              icon="eye"
              size="sm"
              .title=${__('Visualizza')}
              @click=${() => this.openViewUser(user)}
            ></ui-icon-button>
            <ui-icon-button
              icon="edit"
              size="sm"
              .title=${__('Modifica')}
              @click=${() => this.openEditForm(user)}
            ></ui-icon-button>
            <ui-icon-button
              icon="shield"
              size="sm"
              .title=${__('Assegna ruolo')}
              @click=${() => this.openRoleAssignmentModal(user)}
            ></ui-icon-button>
            ${user._id !== this.currentUser?._id
              ? html`
                  <ui-icon-button
                    icon="trash"
                    size="sm"
                    variant="danger"
                    .title=${__('Disattiva')}
                    @click=${() => this.openDeleteModal(user)}
                  ></ui-icon-button>
                `
              : nothing}
          </div>
        </td>
      </tr>
    `;
  }

  private renderForm() {
    const isEdit = this.viewMode === 'edit';

    return html`
      <div class="max-w-2xl mx-auto">
        <!-- Header -->
        <ui-page-header
          .title=${isEdit ? __('Modifica Utente') : __('Nuovo Utente')}
          .description=${isEdit
            ? `${__('Modifica i dati di')} ${this.selectedUser?.username}`
            : __('Crea un nuovo account utente')}
          showBack
          @back=${this.handleCancel}
        ></ui-page-header>

        <!-- Messages -->
        ${this.error
          ? html`<ui-alert variant="danger" .message=${this.error} class="mb-4"></ui-alert>`
          : nothing}
        ${this.success
          ? html`<ui-alert variant="success" .message=${this.success} class="mb-4"></ui-alert>`
          : nothing}

        <!-- Form -->
        <ui-card>
          <div class="space-y-5">
            <ui-input
              .label=${__('Username')}
              .placeholder=${__('mario_rossi')}
              .value=${this.formData.username}
              @input=${(e: InputEvent) =>
                (this.formData = {
                  ...this.formData,
                  username: (e.target as HTMLInputElement).value,
                })}
              required
            ></ui-input>

            <ui-input
              type="email"
              .label=${__('Email')}
              .placeholder=${__('mario@example.com')}
              .value=${this.formData.email}
              @input=${(e: InputEvent) =>
                (this.formData = { ...this.formData, email: (e.target as HTMLInputElement).value })}
              required
            ></ui-input>

            <ui-input
              type="password"
              .label=${isEdit
                ? __('Nuova Password (lascia vuoto per non modificare)')
                : __('Password')}
              .placeholder="••••••••"
              .value=${this.formData.password}
              @input=${(e: InputEvent) =>
                (this.formData = {
                  ...this.formData,
                  password: (e.target as HTMLInputElement).value,
                })}
              ?required=${!isEdit}
            ></ui-input>

            <ui-select
              .label=${__('Ruolo Globale')}
              .value=${this.formData.role}
              .options=${Object.values(UserRole).map((role) => ({
                value: role,
                label: userService.getRoleLabel(role),
              }))}
              @select-change=${(e: CustomEvent) =>
                (this.formData = {
                  ...this.formData,
                  role: e.detail.value as UserRole,
                })}
            ></ui-select>
          </div>

          <!-- Checkbox section -->
          <div class="mt-8 pt-6 border-t border-surface-200 dark:border-surface-700">
            <ui-checkbox
              .label=${__('Account attivo')}
              .hint=${__("Se disattivo, l'utente non potrà accedere al sistema")}
              ?checked=${this.formData.isActive}
              @checkbox-change=${(e: CustomEvent) =>
                (this.formData = {
                  ...this.formData,
                  isActive: e.detail.checked,
                })}
            ></ui-checkbox>
          </div>

          <!-- Actions -->
          <div
            class="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-surface-200 dark:border-surface-700"
          >
            <ui-button
              variant="ghost"
              .label=${__('Annulla')}
              @click=${this.handleCancel}
            ></ui-button>
            <ui-button
              variant="primary"
              .label=${isEdit ? __('Salva Modifiche') : __('Crea Utente')}
              @click=${this.handleSubmit}
              ?loading=${this.saving}
            ></ui-button>
          </div>
        </ui-card>
      </div>
    `;
  }

  private renderUserDetail() {
    if (!this.selectedUser) return nothing;

    const user = this.selectedUser;

    return html`
      <div class="max-w-3xl mx-auto">
        <!-- Header -->
        <div class="flex items-center gap-4 mb-6">
          <ui-icon-button icon="arrow-left" size="md" @click=${this.handleCancel}></ui-icon-button>
          <div class="flex-1">
            <h1 class="text-2xl font-bold text-surface-900 dark:text-white">${user.username}</h1>
            <p class="text-sm text-surface-500 dark:text-surface-400">${user.email}</p>
          </div>
          <ui-button
            variant="outline"
            icon="edit"
            .label=${__('Modifica')}
            @click=${() => this.openEditForm(user)}
          ></ui-button>
        </div>

        <!-- User info card -->
        <ui-panel-section
          .title=${__('Informazioni Generali')}
          icon="user"
          class="mb-6"
          .renderContent=${() => html`
            <dl class="grid grid-cols-2 gap-4">
              <div>
                <dt class="text-sm text-surface-500">${__('Ruolo Globale')}</dt>
                <dd class="mt-1">${this.renderRoleBadge(user.role, 'primary')}</dd>
              </div>
              <div>
                <dt class="text-sm text-surface-500">${__('Stato')}</dt>
                <dd class="mt-1">${this.renderStatusBadge(user.isActive)}</dd>
              </div>
              <div>
                <dt class="text-sm text-surface-500">${__('Registrato il')}</dt>
                <dd class="mt-1 text-surface-900 dark:text-white">
                  ${this.formatUserDate(user.createdAt, {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </dd>
              </div>
              <div>
                <dt class="text-sm text-surface-500">${__('Ultimo accesso')}</dt>
                <dd class="mt-1 text-surface-900 dark:text-white">
                  ${user.lastLogin
                    ? this.formatUserDate(user.lastLogin, {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : __('Mai')}
                </dd>
              </div>
            </dl>
          `}
        ></ui-panel-section>

        <!-- Role assignments card -->
        <ui-card>
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-semibold text-surface-900 dark:text-white">
              ${__('Ruoli Contestuali')}
            </h3>
            <ui-button
              variant="outline"
              size="sm"
              icon="plus"
              .label=${__('Aggiungi ruolo')}
              @click=${() => this.openRoleAssignmentModal(user)}
            ></ui-button>
          </div>

          ${user.roleAssignments && user.roleAssignments.length > 0
            ? html`
                <div class="space-y-2">
                  ${user.roleAssignments.map((ra) =>
                    this.renderRoleAssignmentItem(ra, {
                      showIcon: true,
                      removeIcon: 'x',
                      removeTitle: 'Rimuovi',
                    }),
                  )}
                </div>
              `
            : html`
                <div class="text-center py-8 text-surface-500">
                  <ui-icon name="shield" size="lg" class="mb-2 opacity-50"></ui-icon>
                  <p>${__('Nessun ruolo contestuale assegnato')}</p>
                  <p class="text-sm mt-1">
                    ${__('I ruoli contestuali permettono permessi specifici su singole risorse')}
                  </p>
                </div>
              `}
        </ui-card>
      </div>
    `;
  }

  private getResourceIcon(type: ResourceType): string {
    const icons: Record<ResourceType, string> = {
      item: 'document',
      visit: 'map',
      artwork: 'image',
      museum: 'building',
    };
    return icons[type] || 'file';
  }

  private renderRoleAssignmentItem(
    ra: RoleAssignment,
    options: {
      compact?: boolean;
      showIcon?: boolean;
      removeIcon?: 'x' | 'trash';
      removeTitle?: string;
    } = {},
  ) {
    const {
      compact = false,
      showIcon = false,
      removeIcon = 'x',
      removeTitle = 'Rimuovi',
    } = options;

    return html`
      <div
        class="flex items-center justify-between p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50"
      >
        <div class="flex items-center gap-3">
          ${showIcon
            ? html`
                <div
                  class="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center"
                >
                  <ui-icon
                    name=${this.getResourceIcon(ra.resourceType)}
                    size="sm"
                    class="text-brand-600 dark:text-brand-400"
                  ></ui-icon>
                </div>
              `
            : nothing}
          <div>
            <p
              class=${compact
                ? 'text-sm font-medium text-surface-900 dark:text-white'
                : 'font-medium text-surface-900 dark:text-white'}
            >
              ${userService.getContextualRoleLabel(ra.role)}
            </p>
            <p class=${compact ? 'text-xs text-surface-500' : 'text-sm text-surface-500'}>
              ${userService.getResourceTypeLabel(ra.resourceType)}:
              ${this.resourceNames.get(ra.resourceId) ?? ra.resourceId}
            </p>
          </div>
        </div>
        <ui-icon-button
          icon=${removeIcon}
          size="sm"
          variant="danger"
          title=${removeTitle}
          @click=${() => this.handleRemoveRoleAssignment(ra)}
        ></ui-icon-button>
      </div>
    `;
  }

  private renderDeleteModal() {
    return this.deleteModalOpen
      ? html`
          <ui-modal
            .title=${__('Disattiva Utente')}
            message=${`${__("Sei sicuro di voler disattivare l'utente")} "${this.userToDelete?.username}"? ${__("L'utente non potrà più accedere al sistema.")}`}
            variant="danger"
            .confirmLabel=${__('Disattiva')}
            .cancelLabel=${__('Annulla')}
            ?open=${this.deleteModalOpen}
            ?loading=${this.deleting}
            @confirm=${this.handleConfirmDelete}
            @cancel=${() => {
              this.deleteModalOpen = false;
              this.userToDelete = null;
            }}
          ></ui-modal>
        `
      : nothing;
  }

  private renderRoleAssignmentModal() {
    if (!this.roleAssignmentModalOpen) return nothing;

    const existingRoles = this.selectedUser?.roleAssignments ?? [];

    return html`
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        @click=${(e: Event) => {
          if (e.target === e.currentTarget) {
            this.roleAssignmentModalOpen = false;
          }
        }}
      >
        <div
          class="bg-white dark:bg-surface-900 rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col"
        >
          <div class="p-6 border-b border-surface-200 dark:border-surface-700 flex-shrink-0">
            <h3 class="text-lg font-semibold text-surface-900 dark:text-white">
              Ruoli Contestuali — ${this.selectedUser?.username}
            </h3>
          </div>

          <div class="overflow-y-auto flex-1">
            <!-- Existing role assignments -->
            ${existingRoles.length > 0
              ? html`
                  <div class="p-6 pb-0 space-y-2">
                    <p class="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">
                      Ruoli assegnati
                    </p>
                    ${existingRoles.map((ra) =>
                      this.renderRoleAssignmentItem(ra, {
                        compact: true,
                        removeIcon: 'trash',
                        removeTitle: 'Rimuovi ruolo',
                      }),
                    )}
                  </div>
                `
              : nothing}

            <!-- Add new role assignment -->
            <div class="p-6 space-y-4">
              ${existingRoles.length > 0
                ? html`<p class="text-xs font-semibold text-surface-500 uppercase tracking-wider">
                    ${__('Aggiungi ruolo')}
                  </p>`
                : nothing}

              <ui-select
                .label=${__('Tipo di Ruolo')}
                .value=${this.roleAssignmentData.role}
                .options=${Object.values(ContextualRole).map((role) => ({
                  value: role,
                  label: userService.getContextualRoleLabel(role),
                }))}
                @select-change=${(e: CustomEvent) =>
                  (this.roleAssignmentData = {
                    ...this.roleAssignmentData,
                    role: e.detail.value as ContextualRole,
                  })}
              ></ui-select>

              <ui-select
                .label=${__('Tipo di Risorsa')}
                .value=${this.roleAssignmentData.resourceType}
                .options=${Object.values(ResourceType).map((type) => ({
                  value: type,
                  label: userService.getResourceTypeLabel(type),
                }))}
                @select-change=${(e: CustomEvent) => {
                  const newType = e.detail.value as ResourceType;
                  this.roleAssignmentData = {
                    ...this.roleAssignmentData,
                    resourceType: newType,
                    resourceId: '',
                  };
                  this.loadResourceOptions(newType);
                }}
              ></ui-select>

              <ui-search-list-picker
                .label=${__('Risorsa')}
                .placeholder=${__('Cerca per nome...')}
                .loadingText=${__('Caricamento risorse...')}
                .emptyText=${__('Nessuna risorsa disponibile')}
                .noResultsText=${__('Nessun risultato')}
                .loading=${this.resourceOptionsLoading}
                .options=${this.resourceOptions}
                .value=${this.roleAssignmentData.resourceId}
                @value-change=${(e: CustomEvent<{ value: string }>) => {
                  this.roleAssignmentData = {
                    ...this.roleAssignmentData,
                    resourceId: e.detail.value,
                  };
                }}
              ></ui-search-list-picker>
            </div>

            <div
              class="flex items-center justify-end gap-3 p-6 border-t border-surface-200 dark:border-surface-700 flex-shrink-0"
            >
              <ui-button
                variant="ghost"
                .label=${__('Chiudi')}
                @click=${() => (this.roleAssignmentModalOpen = false)}
              ></ui-button>
              <ui-button
                variant="primary"
                .label=${__('Assegna ruolo')}
                @click=${this.handleAddRoleAssignment}
                ?loading=${this.saving}
              ></ui-button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
