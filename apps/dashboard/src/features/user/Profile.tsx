import { UserProfile } from "@clerk/react";
import { useState } from "react";

import { LocalizedContentLocaleSelect } from "@/components/LocalizedContentLocaleSelect";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardLocalization } from "@/context/LocalizationContext";

export default function Profile() {
  const { contentLocale, setContentLocale } = useDashboardLocalization();
  const [pendingLocale, setPendingLocale] = useState<typeof contentLocale | null>(null);

  const handleContentLocaleChange = (nextLocale: typeof contentLocale) => {
    if (nextLocale === contentLocale) {
      return;
    }

    setPendingLocale(nextLocale);
  };

  const confirmContentLocaleChange = () => {
    if (!pendingLocale) {
      return;
    }

    setContentLocale(pendingLocale);
    window.location.reload();
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Dashboard Preferences</CardTitle>
          <CardDescription>
            {/* TODO: make this more user friendly. */}
            Choose the preferred language for content. This affects in which language existing
            content is displayed and in which language new content is created. Editing localized
            fields in forms is NOT supported because there are too many edge cases to consider, e.g.
            if you're prefered locale is locale A but you want to edit content that is missing some
            translations for locale A, should the form show the fallback content for locale B? And
            if yes, should it warn you that you're editing the fallback content for locale B while
            your prefered locale is A? Due to these complexities, localized fields are read-only in
            forms. For displayed content fallback logic is applied, so if content is missing for the
            prefered locale, it will be shown in another available locale.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LocalizedContentLocaleSelect
            value={contentLocale}
            onValueChange={handleContentLocaleChange}
            label="Content language"
            triggerClassName="w-full"
          />
        </CardContent>
      </Card>
      <UserProfile />
      <AlertDialog
        open={pendingLocale !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingLocale(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change content language?</AlertDialogTitle>
            <AlertDialogDescription>
              Changing content language will reload the page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmContentLocaleChange}>
              Change and reload
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
