#!/usr/bin/env ruby
# Attach privacy manifest to the INDEPENDENT IFund iPhone App target only.
# This runs after Capacitor generates a fresh Xcode project; no Base44 edits.
require 'xcodeproj'
require 'fileutils'

project_path, manifest_path = ARGV
abort('Missing independent project or app privacy manifest') if project_path.to_s.empty? || manifest_path.to_s.empty?
abort('Project outside the independent IFund package') unless project_path.end_with?('/apps/mobile/ios/App/App.xcodeproj')
abort('Missing privacy manifest') unless File.file?(manifest_path)
project = Xcodeproj::Project.open(project_path)
target = project.targets.select { |t| t.name == 'App' && t.product_type == 'com.apple.product-type.application' }
abort('Expected exactly one iFund application target') unless target.length == 1
app_target = target.first
identifiers = app_target.build_configurations.map { |c| c.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] }.uniq
abort('Refusing non-IFund iOS product') unless identifiers == ['com.interplanetaryfund.app']
group = project.main_group.find_subpath('App', false)
abort('Generated App source group is missing') unless group
ref = group.files.find { |f| f.path == 'PrivacyInfo.xcprivacy' } || group.new_file('PrivacyInfo.xcprivacy')
unless app_target.resources_build_phase.files_references.include?(ref)
  app_target.resources_build_phase.add_file_reference(ref, true)
end
project.save
puts 'Attached PrivacyInfo.xcprivacy to independent IFund application resources.'
