import { TopBar } from '../../components/layout/TopBar'
import { EmptyWorkspace } from '../../components/common/EmptyWorkspace'
import { Button } from '../../components/common/Button'
import { FolderPlus, Layers } from 'lucide-react'
import React from 'react'

export function Projects(): React.JSX.Element {
  return (
    <div className="flex flex-col h-full bg-background">
      <TopBar />
      <div className="flex-1 p-24 md:p-32 w-full flex items-center justify-center">
        <div className="w-full max-w-[800px]">
          <EmptyWorkspace
            title="No projects yet"
            description="Your projects will be managed here, completely offline. Future updates will allow you to generate smart templates or instantiate a new project via the AI assistant."
            icon={<Layers className="w-10 h-10 text-text-secondary/60" />}
            action={
              <Button leftIcon={<FolderPlus className="w-[18px] h-[18px]" />} size="lg" disabled>
                Create Project
              </Button>
            }
          />
        </div>
      </div>
    </div>
  )
}
