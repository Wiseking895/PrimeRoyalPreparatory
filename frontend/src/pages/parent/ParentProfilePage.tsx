import { useState } from 'react'
import { Mail, Phone, ShieldCheck, UserRound, Users } from 'lucide-react'
import { useParentAuth } from '@/auth/ParentAuthContext'
import {
  AccountDetailsCard,
  ProfileAvatar,
  ProfileHeader,
  ProfileIdentityCard,
  SecurityCard,
} from '@/components/dashboard/profile'
import type { AccountDetailRow, ProfileSection } from '@/components/dashboard/profile'
import { Badge } from '@/components/dashboard/Badge'
import { Spinner } from '@/components/dashboard/Loaders'
import { api } from '@/lib/api'

const sections: ProfileSection[] = [
  { id: 'general', label: 'General' },
  { id: 'security', label: 'Security' },
]

export function ParentProfilePage() {
  const { profile } = useParentAuth()

  const [activeSection, setActiveSection] = useState('general')

  const jumpTo = (id: string) => {
    setActiveSection(id)
    document.getElementById(`profile-section-${id}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  if (!profile) {
    return (
      <div className="rounded-3xl bg-royal-900 p-5 sm:p-7 lg:p-8">
        <div className="flex items-center gap-3 text-cream-200">
          <Spinner className="h-5 w-5" />
          <span className="text-sm font-medium">Loading your profile…</span>
        </div>
      </div>
    )
  }

  const detailRows: AccountDetailRow[] = [
    { icon: <UserRound className="h-4 w-4" />, label: 'Full name', value: profile.fullName },
    { icon: <Mail className="h-4 w-4" />, label: 'Sign-in email', value: profile.email },
    {
      icon: <Users className="h-4 w-4" />,
      label: 'Linked children',
      value: String(profile.linkedPupilCount),
    },
    {
      icon: <ShieldCheck className="h-4 w-4" />,
      label: 'Account status',
      value: profile.status === 'ACTIVE' ? 'Active' : 'Inactive',
    },
  ]
  if (profile.phone) {
    detailRows.push({
      icon: <Phone className="h-4 w-4" />,
      label: 'Phone',
      value: profile.phone,
    })
  }

  return (
    <div className="space-y-6 rounded-3xl bg-royal-900 p-5 sm:p-7 lg:p-8">
      <ProfileHeader
        breadcrumb="Parent Portal"
        title="My Profile"
        description="Manage your account details and security settings."
        sections={sections}
        activeSection={activeSection}
        onSectionSelect={jumpTo}
      />

      <ProfileIdentityCard
        avatar={<ProfileAvatar name={profile.fullName} imageUrl={null} />}
        name={profile.fullName}
        status={profile.status}
        email={profile.email}
        phone={profile.phone}
        roles={['PARENT']}
        extraBadges={
          <Badge tone="neutral">
            {profile.linkedPupilCount} linked{' '}
            {profile.linkedPupilCount === 1 ? 'child' : 'children'}
          </Badge>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div id="profile-section-general" className="scroll-mt-4">
          <AccountDetailsCard
            description="Your parent account fields."
            rows={detailRows}
          />
        </div>

        <div id="profile-section-security" className="h-fit scroll-mt-4">
          <SecurityCard
            onChangePassword={(currentPassword, newPassword) =>
              api.parentChangePassword(currentPassword, newPassword)
            }
          />
        </div>
      </div>
    </div>
  )
}
