import { useState } from 'react'
import {
  CalendarDays,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import {
  AccountDetailsCard,
  ProfileAvatar,
  ProfileHeader,
  ProfileIdentityCard,
  SecurityCard,
  categoryDisplay,
  positionDisplay,
  roleLabel,
} from '@/components/dashboard/profile'
import type { AccountDetailRow, ProfileSection } from '@/components/dashboard/profile'
import { Spinner } from '@/components/dashboard/Loaders'
import { useToast } from '@/components/dashboard/Toast'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/date'

const sections: ProfileSection[] = [
  { id: 'general', label: 'General' },
  { id: 'security', label: 'Security' },
]

export function ProfilePage() {
  const { user, refreshUser } = useAuth()
  const { push } = useToast()

  const [activeSection, setActiveSection] = useState('general')
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handlePictureUpload = async (file: File) => {
    setUploading(true)
    try {
      await api.uploadProfilePicture(file)
      await refreshUser()
      push('success', 'Profile picture updated.')
    } catch (err) {
      push('error', err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const handlePictureDelete = async () => {
    setDeleting(true)
    try {
      await api.deleteProfilePicture()
      await refreshUser()
      push('success', 'Profile picture removed.')
    } catch (err) {
      push('error', err instanceof Error ? err.message : 'Delete failed.')
    } finally {
      setDeleting(false)
    }
  }

  const jumpTo = (id: string) => {
    setActiveSection(id)
    document.getElementById(`profile-section-${id}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  if (!user) {
    return (
      <div className="rounded-3xl bg-royal-900 p-5 sm:p-7 lg:p-8">
        <div className="flex items-center gap-3 text-cream-200">
          <Spinner className="h-5 w-5" />
          <span className="text-sm font-medium">Loading your profile…</span>
        </div>
      </div>
    )
  }

  const memberSince = user.createdAt ? formatDate(user.createdAt) : null
  const lastLogin = user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'

  const detailRows: AccountDetailRow[] = [
    { icon: <UserRound className="h-4 w-4" />, label: 'Full name', value: user.fullName },
    { icon: <Mail className="h-4 w-4" />, label: 'Email', value: user.email },
  ]
  if (user.phone) {
    detailRows.push({ icon: <Phone className="h-4 w-4" />, label: 'Phone', value: user.phone })
  }
  if (user.staffId) {
    detailRows.push({
      icon: <ShieldCheck className="h-4 w-4" />,
      label: 'Staff ID',
      value: user.staffId,
    })
  }
  if (user.roles.length > 0) {
    detailRows.push({
      icon: <UserRound className="h-4 w-4" />,
      label: 'Role',
      value: user.roles.map(roleLabel).join(', '),
    })
  }
  const positionLabel = positionDisplay(user.position)
  if (positionLabel) {
    detailRows.push({
      icon: <UserRound className="h-4 w-4" />,
      label: 'Position',
      value: positionLabel,
    })
  }
  const categoryLabel = categoryDisplay(user.category)
  if (categoryLabel) {
    detailRows.push({
      icon: <UserRound className="h-4 w-4" />,
      label: 'Category',
      value: categoryLabel,
    })
  }
  detailRows.push({
    icon: <ShieldCheck className="h-4 w-4" />,
    label: 'Account status',
    value: user.status === 'ACTIVE' ? 'Active' : 'Inactive',
  })
  if (memberSince) {
    detailRows.push({
      icon: <CalendarDays className="h-4 w-4" />,
      label: 'Member since',
      value: memberSince,
    })
  }
  detailRows.push({
    icon: <CalendarDays className="h-4 w-4" />,
    label: 'Last sign-in',
    value: lastLogin,
  })

  return (
    <div className="space-y-6 rounded-3xl bg-royal-900 p-5 sm:p-7 lg:p-8">
      <ProfileHeader
        breadcrumb="Account"
        title="Profile"
        description="Manage your account details and security settings."
        sections={sections}
        activeSection={activeSection}
        onSectionSelect={jumpTo}
      />

      <ProfileIdentityCard
        avatar={
          <ProfileAvatar
            name={user.fullName}
            imageUrl={user.profilePictureUrl}
            uploading={uploading}
            deleting={deleting}
            onUpload={handlePictureUpload}
            onRemove={handlePictureDelete}
          />
        }
        name={user.fullName}
        status={user.status}
        email={user.email}
        phone={user.phone}
        staffId={user.staffId}
        roles={user.roles}
        position={user.position}
        category={user.category}
        joined={memberSince}
        lastLogin={lastLogin}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div id="profile-section-general" className="scroll-mt-4">
          <AccountDetailsCard
            description="Profile fields from your staff account."
            rows={detailRows}
          />
        </div>

        <div id="profile-section-security" className="h-fit scroll-mt-4">
          <SecurityCard
            onChangePassword={(currentPassword, newPassword) =>
              api.changePassword(currentPassword, newPassword)
            }
          />
        </div>
      </div>
    </div>
  )
}
